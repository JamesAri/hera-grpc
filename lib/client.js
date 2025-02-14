const EventEmitter = require('node:events').EventEmitter
const debug = require('debug')('service-client')

const Zookeeper = require('./zookeeper')
const GRPCServer = require('./grpc-server')
const RemoteServices = require('./remote-services')
const { loadServiceFromFile, getProtoJsonDescriptorBuffer } = require('./utils')

module.exports = class ServiceClient extends EventEmitter {
	constructor({ config /* zookeeper */ }) {
		super()
		this.host = config.connection.host
		this.port = config.connection.port

		this.zookeeper = new Zookeeper(config)

		this.remoteServices = new RemoteServices({ zookeeper: this.zookeeper }) // TODO: DI

		this.server = new GRPCServer()

		// protobuffers to register to zk
		this.toRegister = null

		this.connectCalled = false
	}

	close() {
		debug('emitting close')
		this.emit('close')
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

		this._connectToZookeeper(() => {
			// first we watch services already registered in zookeeper
			this._connect()

			// if there are services to register, we register them to the
			// gRPC server, zookeeper and lastly listen on the gRPC server.
			if (this.toRegister) {
				this._listen()
			}
		})
	}

	_connect() {
		this.zookeeper.on('services', (servicesByRoute) => {
			debug('zk services were updated')
			this.remoteServices.update(servicesByRoute)
		})

		this.zookeeper.once('services', () => {
			debug('emitting connected')
			this.emit('connected')
		})

		this.zookeeper.watchServices()
	}

	_listen() {
		this.server.listen(this.host, this.port, (error, boundPort) => {
			if (error) {
				this._error(`Server binding failed - ${this.host}:${this.port}: ${error.message}`)
				return
			}

			this.port = boundPort

			this._connectToZookeeper(() => {
				debug('Registering grpc services to zookeeper')

				const serviceInfo = {
					host: this.host,
					port: boundPort,
				}

				this.zookeeper.register(serviceInfo, this.toRegister, (error, res) => {
					if (error) {
						this._error(`Error registering service to zookeeper: ${error}`)
						return
					}
					delete this.toRegister
					debug(`Services successfully registered to zookeeper: ${res}`)
					debug('emitting registered')
					this.emit('registered', boundPort)
				})
			})
		})
	}

	_createRemoteHandlers(handlers) {
		const remoteHandlers = {}
		for (const [key, fn] of Object.entries(handlers)) {
			if (typeof fn !== 'function') {
				this._error(`Service handler ${key} must be a function`)
				return null
			}
			remoteHandlers[key] = function () {
				return fn(this, ...arguments)
			}
		}
		return remoteHandlers
	}

	registerService(route, filename, serviceName, handlers, loadOptions = null) {
		if (this.connectCalled) {
			this._error('Cannot register services after connecting')
			return
		}

		debug(`Registering service ${serviceName} with proto file ${filename} for route ${route}`)

		// port = 0 => random port
		if (!this.host || this.port == null) {
			this._error('Host and port must be provided during initialization to register a service')
			return
		}

		if ('includeDirs' in loadOptions) {
			this._error('includeDirs load option is not supported')
			return
		}

		if (!route) {
			this._error('Route must be provided to register a service')
			return
		}

		if (!filename) {
			this._error('Proto file must be provided to register a service')
			return
		}

		if (!serviceName) {
			this._error('Service name must be provided to register a service')
			return
		}

		if (!handlers || typeof handlers !== 'object') {
			this._error('Service handlers must be an object containing named rpc methods')
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
				buffer: getProtoJsonDescriptorBuffer(filename),
				serviceName,
				loadOptions,
			})
		} catch (error) {
			this._error(`Error parsing proto files ${filename}: ${error}`)
			return
		}

		try {
			const { ServiceStub } = loadServiceFromFile(filename, serviceName, loadOptions)
			this.server.registerService(ServiceStub, remoteHandlers)
		} catch (error) {
			this._error(`Error registering service with route ${route} to grpc server: ${error.message}`)
			return
		}

		debug(`Registered service ${serviceName} with route ${route} to grpc server`)
	}

	async callService(route, cb) {
		let remoteService
		try {
			remoteService = await this.remoteServices.getService(route)
			if (!remoteService) {
				// TODO: retry
				this._error(`No service available for route ${route}`)
				return
			}
			const client = remoteService.connect()
			await cb(client)
		} catch (error) {
			const serviceName = remoteService?.serviceName || ''
			this._error(`Error calling service ${serviceName} with route ${route}: ${error.message}`)
			return
		}
		debug(`Service with route ${route} called`)
	}
}
