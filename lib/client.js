const EventEmitter = require('node:events').EventEmitter

const { trace } = require('@opentelemetry/api')
const debug = require('debug')('service-client')
const debugzk = require('debug')('service-client:zookeeper')
const debugEmit = require('debug')('service-client:emitting')
const debugRegister = require('debug')('service-client:register')

const { Logger } = require('../experimental/logger')

const config = require('./config')
const GRPCServer = require('./grpc-server')
const internalServices = require('./proto/internal-services')
const RemoteServices = require('./remote-services')
const {
	loadServiceFromFile,
	getProtoJsonDescriptorBuffer,
	retry,
	serializeLoadOptions,
	getPublicInterface,
} = require('./utils')
const Zookeeper = require('./zookeeper')

const NAMESPACE = 'service-client'
const logger = new Logger(NAMESPACE)
const tracer = trace.getTracer(NAMESPACE, '0.0.1')

module.exports = class ServiceClient extends EventEmitter {
	constructor(options) {
		super()
		this.close = this.close.bind(this)
		this.connect = this.connect.bind(this)
		this.registerService = this.registerService.bind(this)
		this.getStub = this.getStub.bind(this)

		debug('Options:', options)

		this.host = getPublicInterface()
		this.port = 0 // random available port
		this.serverOptions = options.serverOptions
		this.zkConnection = options.zk
		// protobuffers to register to zk
		this.toRegister = null
		this.connectCalled = false
		this.connected = false
		this.closeCalled = false
		this.closed = false

		this.zookeeper = new Zookeeper(this.zkConnection) // TODO: DI
		this.remoteServices = new RemoteServices({ zookeeper: this.zookeeper }) // TODO: DI

		this.grpcServer = new GRPCServer(this.serverOptions)

		if (options.logLevel != null) {
			Logger.setLevel(options.logLevel)
		}
	}

	async close() {
		if (this.closeCalled) {
			return
		}
		this.closeCalled = true
		this.connected = false

		const emitClose = () => {
			this.closed = true
			debugEmit('close')
			this.emit('close')
		}

		if (!this.connectCalled) {
			emitClose()
			return
		}

		this.zookeeper.disconnect()
		this.zookeeper.removeAllListeners()

		if (!this.grpcServer.isListening()) {
			emitClose()
			return
		}

		debug('Initiating gRPC server graceful shutdown')
		logger.info('Initiating gRPC server graceful shutdown')

		const timeout = setTimeout(() => {
			debug('gRPC server shutdown timed out, forcing shutdown')
			logger.warn('gRPC server shutdown timed out, forcing shutdown')

			this.grpcServer.forceShutdown()
			emitClose()
		}, config.timeouts.forceServerShutdown)

		await this.grpcServer.tryShutdown()
		clearTimeout(timeout)

		if (!this.closed) {
			debug('Graceful shutdown successful')
			logger.info('Graceful shutdown successful')
			emitClose()
		}
	}

	_connectToZookeeper() {
		return new Promise((resolve, reject) => {
			try {
				this.zookeeper.once('connected', () => {
					debugzk('ready')
					resolve()
				})

				this.zookeeper.on('connected', () => {
					debugzk('connected')
				})

				this.zookeeper.on('disconnected', () => {
					debugzk('disconnected')
				})

				this.zookeeper.connect()
			} catch (error) {
				reject(new Error(`Error connecting to zookeeper: ${error.message}`))
			}
		})
	}

	connect() {
		return tracer.startActiveSpan('connectServiceClient', async (span) => {
			if (this.connectCalled) {
				throw new Error('connect called more than once, create new instance to connect again')
			}
			this.connectCalled = true

			// If there are services to register, we:
			//
			// 0) connect to zk
			// 1) start the zk services watch
			// 		- (so when we register our services to zk, we can start replying immediately)
			// 2) register our services to the gRPC server
			// 3) start the gRPC server
			// 4) register our services to the zk and emit "registered"
			// 5) (in this step, we could already be receiving requests)
			// 6) all should be prepared, we emit "connected"

			// If there are no services, its only step 0, 1 and 6

			await new Promise((resolve, reject) => {
				const ready = () => {
					this.connected = true
					logger.info('Hera-GRPC connected')

					debugEmit('connected')
					this.emit('connected')

					span.end()
					resolve()
				}

				this.zookeeper.on('services', (servicesByRoute) => {
					debugzk('zk services were updated')
					logger.debug('zk services were updated')
					this.remoteServices.update(servicesByRoute)
				})

				this.zookeeper.once('services', async () => {
					if (this.toRegister) {
						try {
							await this._listen()
						} catch (error) {
							reject(error)
							return
						}
					}
					ready()
				})

				this._connectToZookeeper().then(() => {
					this.zookeeper.watchServices()
				})
			})
		})
	}

	async _listen() {
		try {
			const boundPort = await this.grpcServer.listen(this.host, this.port)
			this.port = boundPort
		} catch (error) {
			throw new Error(`Server binding failed - ${this.host}:${this.port}: ${error.message}`)
		}

		try {
			debug('Registering grpc services to zookeeper')

			const serviceInfo = {
				host: this.host,
				port: this.port,
			}

			const znode = await this.zookeeper.register(serviceInfo, this.toRegister)
			delete this.toRegister

			debugEmit('registered', this.port)
			this.emit('registered', this.port)

			debug(`Services successfully registered to zookeeper: ${znode}`)
		} catch (error) {
			throw new Error(`Error registering service to zookeeper: ${error}`)
		}
	}

	_wrapHandlers(handlers) {
		const remoteHandlers = {}
		const getStub = this.getStub

		for (const [rpcName, handler] of Object.entries(handlers)) {
			if (typeof handler !== 'function') {
				throw new Error(`Service handler ${rpcName} must be a function`)
			}
			if (rpcName === 'getStub') {
				throw new Error('Service handler name "getStub" is reserved')
			}
			remoteHandlers[rpcName] = function () {
				// the first argument to the handler is always the Call object
				const parentCall = arguments[0]

				parentCall.getStub = (route, clientOptions) => getStub(route, clientOptions, parentCall)
				// TODO: log uncaught errors
				return handler(...arguments)
			}
		}
		return remoteHandlers
	}

	async getStub(route, clientOptions, parentCall = null) {
		try {
			if (!this.connected) {
				throw new Error('Cannot get stub, because Service Client is not connected')
			}
			let grpcClient

			try {
				await retry(
					config.retry.getService.maxAttempts,
					config.retry.getService.delay,
					async () => {
						grpcClient = await this.remoteServices.getService(route)
					},
				)
			} catch (error) {
				throw new Error(`No service available for route ${route}: ${error.message}`)
			}

			try {
				return grpcClient.createStub(clientOptions, parentCall)
			} catch (error) {
				throw new Error(
					`Couldn't create stub for service ${grpcClient.serviceName} with route ${route}: ${error.message}`,
				)
			}
		} catch (error) {
			debug(`Error getting stub for route ${route}: ${error.message}`)
			logger.error(error)
			throw error
		}
	}

	registerService({ routes, serviceName, handlers, filename, loadOptions }) {
		try {
			if (this.connectCalled) {
				throw new Error('Cannot register services after connecting')
			}

			// internal service is a service defined by this library
			// that means we do not have to save/retrieve it to/from zk
			const isInternal = serviceName in internalServices

			debugRegister(`Registering service | ${serviceName} | ${routes} | internal: ${isInternal}`)
			debugRegister(`=> Proto file(s):`, filename)
			debugRegister(`=> Proto file load options:`, serializeLoadOptions(loadOptions))

			if (isInternal) {
				debugRegister('Using internal proto file(s) and load options')
				filename = internalServices[serviceName].filename
				loadOptions = internalServices[serviceName].loadOptions
			}

			// port = 0 means random port
			if (!this.host || this.port == null) {
				throw new Error('Host and port must be provided to register services')
			}

			if (!serviceName) {
				throw new Error(`${routes} | Service name must be provided to register a service`)
			}

			if (!routes) {
				throw new Error(`${serviceName} | Routes must be provided to register a service`)
			}

			if (!Array.isArray(routes)) {
				routes = [routes]
			}

			if (!filename) {
				throw new Error(`${serviceName} | Proto file(s) must be provided to register a service`)
			}

			if (!handlers || typeof handlers !== 'object') {
				throw new Error(
					`${serviceName} | Service handlers must be an object containing named rpc methods`,
				)
			}

			const wrappedHandlers = this._wrapHandlers(handlers)

			// argument to zk.register, will be registered to zk on connect()
			try {
				this.toRegister = this.toRegister || []
				this.toRegister.push({
					routes,
					buffer: isInternal || getProtoJsonDescriptorBuffer(filename, loadOptions?.includeDirs),
					serviceName,
					loadOptions,
					isInternal,
				})
			} catch (error) {
				throw new Error(`Error parsing proto files ${filename}: ${error}`)
			}

			// register service to grpc server
			try {
				const { ServiceStub, packageDefinition } = loadServiceFromFile(
					filename,
					serviceName,
					loadOptions,
				)
				this.grpcServer.registerService(ServiceStub, wrappedHandlers, packageDefinition)
			} catch (error) {
				throw new Error(`Error registering service with routes ${routes}: ${error.message}`)
			}

			debugRegister(`Successfully registered service to grpc server | ${serviceName} | ${routes}`)
		} catch (error) {
			debugRegister(`Error ${serviceName} | ${routes} | ${error.message}`)
			logger.error(error)
			throw error
		}
	}
}
