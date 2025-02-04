const fs = require('fs')
const os = require('os')
const EventEmitter = require('node:events').EventEmitter
const debug = require('debug')('service-client')

const GRPCClient = require('./grpc-client')
const GRPCServer = require('./grpc-server')
const errors = require('./errors')
const { loadServiceFactory } = require('./utils')
const serviceDiscoveryConfig = require('./proto/service-discovery-config')
const appConfig = require('./config')
const logger = require('./logger')('service-client')

module.exports = class ServiceClient extends EventEmitter {
	constructor({config, zookeeper}) {
		super()

		this.loadServices = this._onServices.bind(this)

		this.host = config.connection.host
		this.port = config.connection.port
		this.zookeeper = zookeeper

		this.opts = appConfig.opts
		this.opts.verbosity = this.appConfig.verbosity.default

		if (config.verbosity) {
			this.setVerbosity(config.verbosity)
		}

		this.server = new GRPCServer()

		this.client = new GRPCClient(loadServiceFactory(serviceDiscoveryConfig))
		this.client.connect(config.grpcServer.host, config.grpcServer.port)

		this.protoBase = fs.mkdtemp(path.join(os.tmpdir(), 'protoBase-'))
	}

	setVerbosity(level) {
		if (level === this.opts.verbosity) {
			logger.info(`verbosity was already set to ${level}`)
			return
		}

		if (!config.verbosity.levels[level]) {
			logger.error(
				`invalid verbosity level '${level}'. Available options:`,
				Object.keys(config.verbosity.levels),
			)
		} else {
			logger.info(`changed verbosity from ${this.opts.verbosity} to ${level}`)
			this.opts.verbosity = level
		}
	}

	_error(error) {
		logger.error(error)
		this.emit('error', error)
	}

	_cleanup() {
		debug('_cleanup called')
	}

	_onServices(allServices) {
		// TODO: continue here
		const services = allServices

		if (!services) {
			this._error(new Error(`There are no services for route ${route}`))
			return
		}

		const service = services[0]

		// cleanup old proto files

		// load new proto files
		const protoFiles = []

		for (const protoFile of rndService.proto) {
			const buffer = await zk.getProtoFile(protoFile.znode)
			protoFiles.push({
				name: protoFile.name,
				buffer: buffer,
			})
		}

		if (!protoFiles) {
			this._error(new Error('Proto files not found'))
			return
		}

		const dir = fs.mkdtemp(path.join(this.protoBase, 'proto-'))

		// TODO: invalidate sometime?
		for (const protoFile of protoFiles) {
			const tmpFilePath = path.join(dir, `${protoFile.name}`)
			fs.writeFileSync(tmpFilePath, protoFile.buffer)
		}

		// update services structure
	}

	connect() {
		this.zookeeper.watchServices()

		this.zookeeper.on('services', this._onServices)

		this.zookeeper.once('services', () => {
			this.emit('connected')
		})
	}

	close() {
		this._cleanup()
		this.emit('close')
	}

	listen() {
		if (!this.host || !this.port) {
			this._error(new Error('Host and port must be provided'))
			return
		}

		this.server.listen(this.host, this.port)
	}

	registerService(serviceInfo, protoFiles, handlers) {
		// check if connected?

		logger.info(`Registering service ${serviceInfo.serviceName} - ${serviceInfo.route}`)

		try {
			this.server.registerService(loadServiceFactory(serviceInfo.loadConfig), handlers)
		} catch (err) {
			this._error(err)
		}

		this.zookeeper.register(serviceInfo, protoFiles, (err, res) => {
			if (err) {
				this._error(err)
				return
			}
			logger.info(`Service ${serviceInfo.serviceName} - ${serviceInfo.route} registered`)
		})
	}

	callService(route, cb) {
		// get random service ?
		const serviceInfo = this.services[route]
		logger.info(`Calling service ${serviceInfo.serviceName} - ${serviceInfo.route}`)

		const serviceConfig = {
			protoroute: '... TODO ...',
			loadOptions: serviceInfo.loadOptions,
			serviceName: serviceInfo.serviceName,
		}
		const { host, port } = serviceInfo

		let client = null
		try {
			client = new GRPCClient(loadServiceFactory(serviceConfig))
			client.connect(host, port)
			cb(client.service)
		} catch (error) {
			this._error(error)
		} finally {
			if (client) {
				client.close()
			}
		}
		debug('Service called:', serviceInfo)
	}
}
