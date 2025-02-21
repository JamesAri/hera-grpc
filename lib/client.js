const EventEmitter = require('node:events').EventEmitter

const debug = require('debug')('service-client')

const config = require('./config')
const GRPCServer = require('./grpc-server')
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
		this.callService = this.callService.bind(this)
		this._callService = this._callService.bind(this)

		this.host = options.connection.host
		this.port = options.connection.port
		this.clientOptions = options.clientOptions
		this.serverOptions = options.serverOptions

		this.zookeeper = new Zookeeper({ config }) // TODO: DI

		this.remoteServices = new RemoteServices({ zookeeper: this.zookeeper }) // TODO: DI

		this.grpcServer = new GRPCServer(this.serverOptions)

		// protobuffers to register to zk
		this.toRegister = null

		this.connectCalled = false
	}

	close() {
		this.zookeeper.disconnect()

		const emitClose = () => {
			debug('emitting close')
			this.emit('close')
		}

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
		debug(`emitting error: ${err.message}`)
		this.emit('error', err)
	}

	_connectToZookeeper(next) {
		this.zookeeper.once('connected', () => {
			debug('zookeeper ready')
			next()
		})

		this.zookeeper.once('connected', () => {
			debug('zookeeper connected') // TODO
		})

		this.zookeeper.on('disconnected', () => {
			debug('zookeeper disconnected') // TODO
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
				debug('zk services were updated')
				this.remoteServices.update(servicesByRoute)
			})

			const ready = () => {
				debug('emitting connected')
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

	_listen() {
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

				debug('emitting registered')
				this.emit('registered', boundPort)
			})
		})
	}

	_createRemoteHandlers(handlers) {
		const remoteHandlers = {}
		const _callService = this._callService

		for (const [key, fn] of Object.entries(handlers)) {
			if (typeof fn !== 'function') {
				this._error(`Service handler ${key} must be a function`)
				return null
			}
			remoteHandlers[key] = function () {
				// the first argument to the handler is always the Call object
				const parentCall = arguments[0]
				return fn(
					// context used from within service handlers accessible as first parameter
					// => allows for remote nested calls - we can trace calls, propagate deadlines, etc.
					{
						callService: (route, cb) => _callService(route, cb, parentCall),
					},
					...arguments,
				)
			}
		}
		return remoteHandlers
	}

	async _callService(route, cb, parentCall = null) {
		let grpcClient

		try {
			await retry(config.retry.getService.maxAttempts, config.retry.getService.delay, async () => {
				grpcClient = await this.remoteServices.getService(route)
				if (!grpcClient) {
					throw new Error('cannot find service')
				}
			})
		} catch (error) {
			this._error(`No service available for route ${route}: ${error.message}`)
			return
		}

		try {
			const client = grpcClient.createClient(this.clientOptions, parentCall)
			await cb(client)
		} catch (error) {
			this._error(
				`Error calling service ${grpcClient.serviceName} with route ${route}: ${error.message}`,
			)
			return
		}
		debug(`Service called | ${grpcClient.serviceName} | ${grpcClient.route}`)
	}

	async callService(route, cb) {
		await this._callService(route, cb)
	}

	registerService(route, filename, serviceName, handlers, loadOptions) {
		if (this.connectCalled) {
			this._error('Cannot register services after connecting')
			return
		}

		debug(
			`Registering service | ${serviceName} | ${route} | ${filename} | ${JSON.stringify(serializeLoadOptions(loadOptions))}`,
		)

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

		try {
			// argument to zk.register
			this.toRegister = this.toRegister || []
			this.toRegister.push({
				route,
				buffer: getProtoJsonDescriptorBuffer(filename, loadOptions?.includeDirs),
				serviceName,
				loadOptions,
			})
		} catch (error) {
			this._error(`Error parsing proto files ${filename}: ${error}`)
			return
		}

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

		debug(`Registered service to grpc server | ${serviceName} | ${route}}`)
	}
}
