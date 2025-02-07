const EventEmitter = require('node:events').EventEmitter
const debug = require('debug')('service-client')

const GRPCClient = require('./grpc-client')
const GRPCServer = require('./grpc-server')
const RemoteServices = require('./remote-services')
const {
	loadServiceFromFile,
	getProtoJsonDescriptorBuffer
} = require('./utils')


module.exports = class ServiceClient extends EventEmitter {
	constructor({ config, zookeeper }) {
		super()
		this.host = config.connection.host
		this.port = config.connection.port

		this.zookeeper = zookeeper

		this.remoteServices = new RemoteServices({zookeeper}) // TODO: DI zk

		this.server = new GRPCServer()

		// Protobuffers to register to zk
		this.toRegister = null
	}

	_error(error) {
		const err = typeof error === 'string' ? new Error(error) : error
		debug(`emitting error: ${err}`)
		this.emit('error', err)
		this.close()
	}

	connectToZookeeper() {
		this.zookeeper.on('connected', () => {
			this.emit('zkReady')
		})
		this.zookeeper.connect()

		// TODO: zk disconnect event
	}

	// TODO: merge connect, listen and connectToZookeeper
	connect() {
		if (this.toRegister) {
			this._error('Services with registered services must be listening before connecting')
			return
		}

		this.zookeeper.watchServices()

		this.zookeeper.on('services', (servicesByRoute) => {
			this.remoteServices.update(servicesByRoute)
		})

		this.zookeeper.on('services', () => {
			this.emit('connected')
		})
	}

	close() {
		debug('close called')
		this.emit('close')
	}

	listen() {
		if (!this.host || !this.port) {
			this._error('Host and port must be provided if you want to listen')
			return
		}

		if (!this.toRegister) {
			this._error('No services registered, nothing to listen for')
			return
		}

		this.server.listen(this.host, this.port, (error) => {
			if (error) {
				this._error(`Server binding failed - ${this.host}:${this.port}: ${error.message}`)
				return
			}
			const serviceInfo = {
				host: this.host,
				port: this.port,
			}
			// TODO: check if we are connected to zk
			this.zookeeper.register(serviceInfo, this.toRegister, (error, _res) => {
				if (error) {
					this._error(`Error registering service to zookeeper: ${error}`)
					return
				}
				delete this.toRegister
				this.emit('registered') // do we need this?
				debug('Services successfully registered to zookeeper')
			})
		})
	}

	registerService(route, filename, serviceName, handlers, loadOptions = null) {
		if (!this.host || !this.port) {
			this._error('Host and port must be provided during initialization to register a service')
			return
		}

		debug(`Registering proto file ${filename} for route ${route}`)

		try {
			this.toRegister = this.toRegister || []
			this.toRegister.push(
				{
					route,
					buffer: getProtoJsonDescriptorBuffer(filename),
					serviceName,
					loadOptions,
				}
			)
		} catch (error) {
			this._error(`Error parsing proto files ${filename}: ${error}`)
			return
		}

		try {
			debug(`Registering route ${route} to grpc server`)

			const { ServiceStub } = loadServiceFromFile(filename, serviceName, loadOptions)
			this.server.registerService(ServiceStub, handlers)

		} catch (error) {
			this._error(`Error registering service with route ${route} to grpc server: ${error.message}`)
			return
		}

		debug(`Route ${route} registered to grpc server`)
	}

	async callService(route, cb) {
		let client
		try {
			const service = await this.remoteServices.getService(route)
			const { host, port } = service.getConnection()
			const ServiceStub = service.getServiceStub()
			const packageDefinition = service.getPackageDefinition()

			debug(`Connecting to service with route ${route}`)
			client = new GRPCClient({ServiceStub, packageDefinition})
			client.connect(host, port)
			cb(client.service)
		} catch (error) {
			this._error(`Error calling service ${route}: ${error.message}`)
			return
		} finally {
			if (client) {
				// client.close()
			}
		}
		debug(`Service for route ${route} called`)
	}
}
