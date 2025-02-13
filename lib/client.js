const EventEmitter = require('node:events').EventEmitter
const debug = require('debug')('service-client')

const Zookeeper = require('./zookeeper')
const GRPCServer = require('./grpc-server')
const RemoteServices = require('./remote-services')
const { loadServiceFromFile, getProtoJsonDescriptorBuffer } = require('./utils')

module.exports = class ServiceClient extends EventEmitter {
	constructor({ config, /* zookeeper */ }) {
		super()
		this.host = config.connection.host
		this.port = config.connection.port

		this.zookeeper = new Zookeeper(config)

		this.remoteServices = new RemoteServices({ zookeeper: this.zookeeper }) // TODO: DI

		this.server = new GRPCServer()

		// protobuffers to register to zk
		this.toRegister = null

		this.zkConnectCalled = false
		this.connectCalled = false
		this.listenCalled = false
	}

	close() {
		debug('close called')
		this.emit('close')
	}

	_error(error) {
		debug('emitting error')
		const err = typeof error === 'string' ? new Error(error) : error
		this.emit('error', err)
	}

	_connectToZookeeper(next) {
		if (this.zkConnectCalled) {
			next()
			return
		}
		this.zkConnectCalled = true
		// TODO: on?
		this.zookeeper.once('connected', () => {
			debug('zookeeper ready')
			next()
		})

		this.zookeeper.once('disconnected', () => {
			// TODO: handle
		})

		this.zookeeper.connect()
	}

	connect() {
		if (this.connectCalled) {
			this._error('connect called more than once')
			return
		}
		this.connectCalled = true

		if (this.toRegister) {
			this._error('Services with registered services must be listening before connecting')
			return
		}

		this._connectToZookeeper(() => {
			this.zookeeper.watchServices()

			this.zookeeper.on('services', (servicesByRoute) => {
				debug('zk services were updated')
				this.remoteServices.update(servicesByRoute)
			})

			this.zookeeper.once('services', () => {
				debug('emitting connected')
				this.emit('connected')
			})
		})
	}

	listen() {
		if (this.listenCalled) {
			this._error('listen called more than once')
			return
		}
		this.listenCalled = true

		if (!this.toRegister) {
			this._error('No services registered, nothing to listen for')
			return
		}

		// TODO: _port
		this.server.listen(this.host, this.port, (error, _port) => {
			if (error) {
				this._error(`Server binding failed - ${this.host}:${this.port}: ${error.message}`)
				return
			}

			this._connectToZookeeper(() => {
				debug('Registering grpc services to zookeeper')

				const serviceInfo = {
					host: this.host,
					port: _port,
				}

				this.zookeeper.register(serviceInfo, this.toRegister, (error, _res) => {
					if (error) {
						this._error(`Error registering service to zookeeper: ${error}`)
						return
					}
					delete this.toRegister
					this.emit('registered', this.host, _port)
					debug('Services successfully registered to zookeeper')
				})
			})
		})
	}

	createRemoteHandlers(handlers) {
		const remoteHandlers = {}
		for (const [key, fn] of Object.entries(handlers)) {
			if (typeof fn !== 'function') {
				this._error(`Service handler ${key} must be a function`)
				return null
			}
			remoteHandlers[key] = function() {
				return fn(this, ...arguments)
			}
		}
		return remoteHandlers
	}

	registerService(route, filename, serviceName, handlers, loadOptions = null) {
		debug(`Registering service ${serviceName} with proto file ${filename} for route ${route}`)

		if (!this.host || !this.port) {
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

		const remoteHandlers = this.createRemoteHandlers(handlers)

		console.log({ remoteHandlers })
		console.log({ handlers })
		if (!remoteHandlers) {
			return
		}

		try {
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

		debug(`Registering service ${serviceName} with route ${route} to grpc server`)

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
				this._error(`No service available for route ${route}`)
				return
			}
			const client = remoteService.connect() // TODO: when to close?
			await cb(client)
		} catch (error) {
			const serviceName = remoteService?.serviceName || ''
			this._error(`Error calling service ${serviceName} with route ${route}: ${error.message}`)
			return
		}
		debug(`Service with route ${route} called`)
	}
}
