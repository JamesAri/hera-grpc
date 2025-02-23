const EventEmitter = require('node:events').EventEmitter

const debug = require('debug')('service-client')
const debugzk = require('debug')('service-client:zookeeper')
const debugEmit = require('debug')('service-client:emitting')
const debugRegister = require('debug')('service-client:register')

const config = require('./config')
const GRPCServer = require('./grpc-server')
const internalServices = require('./proto/internal-services')
const RemoteServices = require('./remote-services')
const {
	loadServiceFromFile,
	getProtoJsonDescriptorBuffer,
	retry,
	serializeLoadOptions,
} = require('./utils')
const Zookeeper = require('./zookeeper')

module.exports = class ServiceClient extends EventEmitter {
	constructor(options) {
		super()
		this.registerService = this.registerService.bind(this)
		this.getStub = this.getStub.bind(this)
		this._getStub = this._getStub.bind(this)

		this.host = options.connection.host
		this.port = options.connection.port
		this.serverOptions = options.serverOptions
		this.zkConnection = options.zk

		this.zookeeper = new Zookeeper(this.zkConnection) // TODO: DI

		this.remoteServices = new RemoteServices({ zookeeper: this.zookeeper }) // TODO: DI

		this.grpcServer = new GRPCServer(this.serverOptions)

		// protobuffers to register to zk
		this.toRegister = null

		this.connectCalled = false
	}

	close() {
		const emitClose = () => {
			debugEmit('close')
			this.emit('close')
		}

		if (!this.connectCalled) {
			emitClose()
			return
		}

		this.zookeeper.disconnect()

		if (this.grpcServer.isListening()) {
			debug('Initiating gRPC server graceful shutdown')

			const timeout = setTimeout(() => {
				debug('gRPC server shutdown timed out, forcing shutdown')
				this.grpcServer.server.forceShutdown()
				emitClose()
			}, config.timeouts.forceServerShutdown)

			this.grpcServer.server.tryShutdown(() => {
				clearTimeout(timeout)
				debug('Graceful shutdown successful')
				emitClose()
			})
		} else {
			emitClose()
		}
	}

	_error(error) {
		const err = typeof error === 'string' ? new Error(error) : error
		debugEmit(`error: ${err.message}`)
		this.emit('error', err)
	}

	_connectToZookeeper(next) {
		this.zookeeper.once('connected', () => {
			debugzk('ready')
			next()
		})

		this.zookeeper.once('connected', () => {
			debugzk('connected')
		})

		this.zookeeper.on('disconnected', () => {
			debugzk('disconnected')
		})

		try {
			this.zookeeper.connect()
		} catch (error) {
			this._error(`Error connecting to zookeeper: ${error.message}`)
		}
	}

	connect() {
		if (this.connectCalled) {
			this._error('connect called more than once, create new instance to connect again')
			return
		}
		this.connectCalled = true

		// If there are services to register, we:
		//
		// 0) connect to zk
		// 1) start the zk services watch
		// 		- (so when we register our services to zk, we can start replying immediately)
		// 2) register our services to the gRPC server
		// 3) start the gRPC server
		// 4) register our services to the zk
		// 5) (in this step, we could already be receiving requests)
		// 6) all should be prepared, we emit "connected"

		// If there are no services, its only step step 0, 1 and 6

		this._connectToZookeeper(() => {
			this.zookeeper.on('services', (servicesByRoute) => {
				debugzk('zk services were updated')
				this.remoteServices.update(servicesByRoute)
			})

			const ready = () => {
				debugEmit('connected')
				this.emit('connected')
			}

			this.zookeeper.once('services', () => {
				if (this.toRegister) {
					this._listen(ready)
				} else {
					ready()
				}
			})

			this.zookeeper.watchServices()
		})
	}

	_listen(next) {
		this.grpcServer.listen(this.host, this.port, (error, boundPort) => {
			if (error) {
				this._error(
					`Server binding failed - ${this.host}:${this.port} (${boundPort}): ${error.message}`,
				)
				return
			}

			this.port = boundPort

			const serviceInfo = {
				host: this.host,
				port: boundPort,
			}

			debug('Registering grpc services to zookeeper')

			this.zookeeper.register(serviceInfo, this.toRegister, (error, res) => {
				if (error) {
					this._error(`Error registering service to zookeeper: ${error}`)
					return
				}
				debug(`Services successfully registered to zookeeper: ${res}`)
				delete this.toRegister

				debugEmit('registered')
				this.emit('registered', boundPort)
				next()
			})
		})
	}

	_createRemoteHandlers(handlers) {
		const remoteHandlers = {}
		const _getStub = this._getStub

		for (const [rpcName, handler] of Object.entries(handlers)) {
			if (typeof handler !== 'function') {
				this._error(`Service handler ${rpcName} must be a function`)
				return null
			}
			remoteHandlers[rpcName] = function () {
				// the first argument to the handler is always the Call object
				const parentCall = arguments[0]
				return handler(
					// context used from within service handlers accessible as first parameter
					// => enables nested calls - we can trace calls, propagate deadlines/cancellations, ...
					{
						getStub: (route, clientOptions) => _getStub(route, clientOptions, parentCall),
					},
					...arguments,
				)
			}
		}
		return remoteHandlers
	}

	async _getStub(route, clientOptions, parentCall = null) {
		let grpcClient

		try {
			await retry(config.retry.getService.maxAttempts, config.retry.getService.delay, async () => {
				grpcClient = await this.remoteServices.getService(route)
			})
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
	}

	async getStub(route, clientOptions) {
		return this._getStub(route, clientOptions)
	}

	registerService({ route, serviceName, handlers, filename, loadOptions }) {
		if (this.connectCalled) {
			this._error('Cannot register services after connecting')
			return
		}

		// internal service is a service defined by this library
		// that means we do not have to save/retrieve it to/from zk
		const isInternal = serviceName in internalServices

		debugRegister(`Registering service | ${serviceName} | ${route} | internal: ${isInternal}`)
		debugRegister(`=> Proto file(s):`, filename)
		debugRegister(`=> Proto file load options:`, serializeLoadOptions(loadOptions))

		if (isInternal) {
			debugRegister('Using internal proto file(s) and load options')
			filename = internalServices[serviceName].filename
			loadOptions = internalServices[serviceName].loadOptions
		}

		// port = 0 means random port
		if (!this.host || this.port == null) {
			this._error('Host and port must be provided during initialization to register services')
			return
		}

		if (!serviceName) {
			this._error(`${route} | Service name must be provided to register a service`)
			return
		}

		if (!route) {
			this._error(`${serviceName} | Route must be provided to register a service`)
			return
		}

		if (!filename) {
			this._error(`${serviceName} | Proto file(s) must be provided to register a service`)
			return
		}

		if (!handlers || typeof handlers !== 'object') {
			this._error(
				`${serviceName} | Service handlers must be an object containing named rpc methods`,
			)
			return
		}

		const remoteHandlers = this._createRemoteHandlers(handlers)

		if (!remoteHandlers) {
			return
		}

		// argument to zk.register, will be registered to zk on connect()
		try {
			this.toRegister = this.toRegister || []
			this.toRegister.push({
				route,
				buffer: isInternal || getProtoJsonDescriptorBuffer(filename, loadOptions?.includeDirs),
				serviceName,
				loadOptions,
				isInternal,
			})
		} catch (error) {
			this._error(`Error parsing proto files ${filename}: ${error}`)
			return
		}

		// register service to grpc server, before we connect to zk
		try {
			const { ServiceStub, packageDefinition } = loadServiceFromFile(
				filename,
				serviceName,
				loadOptions,
			)
			this.grpcServer.registerService(ServiceStub, remoteHandlers, packageDefinition)
		} catch (error) {
			this._error(`Error registering service with route ${route} to grpc server: ${error.message}`)
			return
		}

		debugRegister(`Successfully registered service to grpc server | ${serviceName} | ${route}}`)
	}
}
