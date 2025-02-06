const EventEmitter = require('node:events').EventEmitter
const debug = require('debug')('service-client')

const GRPCClient = require('./grpc-client')
const GRPCServer = require('./grpc-server')
const {
	loadServiceFromFile,
	loadServiceFromBuffer,
	getProtoJsonDescriptorBuffer
} = require('./utils')
const Services = require('./services')

module.exports = class ServiceClient extends EventEmitter {
	constructor({ config, zookeeper }) {
		super()

		this.loadServices = this._onServices.bind(this)

		this.host = config.connection.host
		this.port = config.connection.port

		this.zookeeper = zookeeper

		this.services = new Services({zookeeper}) // TODO: DI

		this.server = new GRPCServer()
	}

	_error(error) {
		debug(`emitting error: ${error}`)
		this.emit('error', error)
	}

	_cleanup() {
		debug('_cleanup called')
	}

	close() {
		debug('close called')
		this._cleanup()
		this.emit('close')
	}

	connect() {
		this.zookeeper.watchServices()

		this.zookeeper.on('services', this._onServices)

		this.zookeeper.once('services', () => {
			this.emit('connected')
		})
	}

	listen() {
		if (!this.host || !this.port) {
			this._error(new Error('Host and port must be provided before listening'))
			return
		}

		this.server.listen(this.host, this.port)
	}

	_onServices(servicesByRoute) {
		this.services.update(servicesByRoute)
	}

	registerService(serviceInfo, protoFiles, handlers) {
		if (!this.host || !this.port) {
			this._error(new Error('Host and port must be provided during initialization to register a service'))
			return
		}

		let protoFileBuffer = null
		try {
			protoFileBuffer = getProtoJsonDescriptorBuffer(protoFiles)
		} catch (error) {
			this._error(new Error(`Error parsing proto files ${protoFiles} - error: ${error.message}`))
			return
		}

		const service = {
			...serviceInfo,
			host: this.host,
			port: this.port,
		}

		debug(`Registering service at ${service.route}`)

		try {
			this.server.registerService(() => loadServiceFromFile(service.loadConfig), handlers)
		} catch (error) {
			this._error(`Error registering service ${service.route} to grpc server - error: ${error.message}`)
			return
		}

		this.zookeeper.register(service, protoFileBuffer, (error, _res) => {
			if (error) {
				this._error(`Error registering service ${service.route} to zookeeper - error: ${error.message}`)
				return
			}
			debug(`Service ${service.route} registered`)
		})
	}

	callService(route, cb) {
		const service = this.services.getService(route)
		const serviceLoadConfig = service.getServiceLoadConfig()
		const { host, port } = service.getConnection()

		debug(`Calling service ${service.name} - ${service.route}`)

		let client = null
		try {
			client = new GRPCClient(() => loadServiceFromFile(serviceLoadConfig))
			client.connect(host, port)
			cb(client.service)
		} catch (error) {
			this._error(`Error calling service ${service.route} - error: ${error.message}`)
			return
		} finally {
			if (client) {
				client.close()
			}
		}
		debug(`Service ${service.name} - ${service.route} called`)
	}
}
