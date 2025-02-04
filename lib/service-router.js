const grpc = require('@grpc/grpc-js')
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('node:crypto')
const EventEmitter = require('node:events').EventEmitter
const debug = require('debug')('service-router')

const serviceDiscoveryConfig = require('./proto/service-discovery-config')
const { loadServiceFactory } = require('./utils')
const { action } = require('./constants')
const GRPCServer = require('./grpc-server')

module.exports = class ServiceRouter extends EventEmitter {
	constructor(options) {
		super()
		this.createSession = this.createSession.bind(this)
		this.registerService = this.registerService.bind(this)
		this.getService = this.getService.bind(this)
		this.listen = this.listen.bind(this)
		this._cleanup = this._cleanup.bind(this)
		this.removeService = this.removeService.bind(this)

		this.server = new GRPCServer()
		this.host = options.host
		this.port = options.port

		if (!this.host) {
			throw new Error('Host not provided')
		}

		if (!this.port) {
			throw new Error('Port not provided')
		}

		this.services = {}
		this.registeredServices = {}

		this._nextId = 0
	}

	listen() {
		this.server.registerService(loadServiceFactory(serviceDiscoveryConfig), {
			createSession: this.createSession,
			registerService: this.registerService,
			getService: this.getService,
		})
		this.server.listen(this.host, this.port)
	}

	removeService(serviceId) {
		if (!this.services[serviceId]) {
			return
		}

		for (const path in this.services[serviceId].services) {
			const protoFilePath = this.services[serviceId].services[path].protoFilePath
			if (protoFilePath) {
				fs.unlink(protoFilePath, (err) => {
					if (err) {
						this.emit('error', new Error(`Error deleting proto file: ${err.message}`))
					}
				})
			}
		}

		delete this.services[serviceId]
	}

	close() {
		this._cleanup()
		// TODO:
		// tryShutdown
		// forceShutdown
	}

	// TODO: register signals to cleanup
	_cleanup() {
		debug('Cleaning up')
		for (const id in this.services.keys()) {
			this.removeService(id)
		}
	}

	_write(stream, action, data) {
		stream.write({ action, ...data })
	}

	_error(stream, error) {
		this._write(stream, action.ERROR, { error: error.message })
	}

	createSession(stream) {
		const serviceId = this._nextId++

		const initialMetadata = new grpc.Metadata()
		initialMetadata.set('x-session-id', serviceId)
		stream.sendMetadata(initialMetadata)

		const onData = (data) => {
			switch (data.action) {
			case action.CONNECT:
				this.services[serviceId] = {
					host: data.connection.host,
					port: data.connection.port,
					services: {},
				}
				this._write(stream, action.CONNECT)
				break
			case action.ERROR:
				stream.end()
				this.emit('error', new Error(`Client-${serviceId} service error: ${data.error.message}`))
				break
			default:
				this.emit('error', new Error(`Unknown action received: ${data.action}`))
			}
		}

		stream.on('data', onData)

		stream.on('end', () => {
			debug(`Stream event ${serviceId} - end`)
			this.removeService(serviceId)
			stream.end()
		})

		stream.on('close', () => {
			debug(`Stream event ${serviceId} - close`)
			stream.removeAllListeners() // ?
		})

		stream.on('error', (err) => {
			this.removeService(serviceId)
			stream.end()
			this.emit('error', new Error(`Client-${serviceId} service error: ${err.message}`))
		})
	}

	registerService(call, callback) {
		const headers = call.metadata.getMap()

		if (!headers['x-path']) {
			callback(new Error('Service path not provided'))
			return
		}

		if (!headers['x-session-id']) {
			callback(new Error('Session id not provided'))
			return
		}

		const servicePath = headers['x-path'] // nananah
		const serviceId = headers['x-session-id']

		const client = this.services[serviceId]

		if (!client) {
			callback(new Error('Client didn\'t connect to the broker'))
			return
		}

		if (!client.services[servicePath]) {
			client.services[servicePath] = {}
		}

		if (client.services[servicePath].protoFilePath) {
			fs.unlink(srv.protoFilePath, (_e) => {})
			delete client.services[servicePath].protoFilePath
		}

		const tempFilePath = path.join(os.tmpdir(), `SERVICE-ROUTER-${crypto.randomUUID()}.proto`)
		const ws = fs.createWriteStream(tempFilePath)

		const removeFile = () => {
			fs.unlink(tempFilePath, (_e) => {})
		}

		ws.on('error', (err) => {
			removeFile()
			callback(new Error(`Proto file download error: ${err.message}`))
		})

		const _onError = (err) => {
			removeFile()
			ws.end()
			callback(new Error(`Proto file download error: ${err.message}`))
		}

		const _onData = (data) => {
			ws.write(data.proto_file_chunk)
		}

		call.on('data', _onData)
		call.on('error', _onError)

		call.once('end', () => {
			ws.end()

			client.services[servicePath].protoFilePath = tempFilePath
			this.registeredServices[servicePath] = serviceId

			debug(`client-${serviceId}-${servicePath}:`)
			debug(client)

			callback(null, {
				success: true,
				message: 'Service successfully registered',
			})
		})
	}

	getService(call) {
		debug({ request: call.request })
		const servicePath = call.request.path
		if (!servicePath) {
			call.emit('error', new Error('Service path not provided'))
			call.end()
		}

		const serviceId = this.registeredServices[servicePath]

		if (!serviceId) {
			call.emit('error', new Error('Service not registered'))
			call.end()
		}

		const service = this.services[serviceId]

		const outgoingHeaders = new grpc.Metadata()
		outgoingHeaders.set('x-connection', `${service.host}:${service.port}`)
		call.sendMetadata(outgoingHeaders)

		if (call.request.refetch_proto_file) {
			const rs = fs.createReadStream(service.services[servicePath].protoFilePath)
			rs.on('data', (chunk) => {
				call.write({ proto_file_chunk: chunk })
			})
			rs.on('end', () => {
				call.end()
			})
		} else {
			call.end()
		}
	}
}
