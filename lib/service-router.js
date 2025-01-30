const grpc = require('@grpc/grpc-js')
const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('node:crypto')
const EventEmitter = require('node:events').EventEmitter

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
		this.cleanup = this.cleanup.bind(this)
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

	// TODO: register signals to cleanup
	cleanup() {
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

		stream.on('data', (data) => {
			switch (data.action) {
			case action.CONNECT:
				this.services[serviceId] = {
					host: data.connection.host,
					port: data.connection.port,
					services: {},
				}
				this._write(stream, action.CONNECTED)
				break
			default:
				this.emit('error', new Error(`Unknown action received: ${data.action}`))
			}
		})

		stream.on('end', () => {
			console.log(`Stream event ${serviceId} - end`)
			this.removeService(serviceId)
			stream.end()
		})

		stream.on('close', () => {
			console.log(`Stream event ${serviceId} - close`)
		})

		stream.on('error', (err) => {
			this.removeService(serviceId)
			this.emit('error', new Error(`Client-${serviceId} service error: ${err.message}`))
			stream.end()
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

		const servicePath = headers['x-path']
		const serviceId = headers['x-session-id']

		const client = this.services[serviceId]

		if (!client) {
			callback(new Error('Client didn\'t connect to the broker'))
			return
		}

		if (!client.services[servicePath]) {
			client.services[servicePath] = {}
		}

		if (client.services[servicePath] && client.services[servicePath].protoFilePath) {
			fs.unlink(srv.protoFilePath, (_e) => {})
			delete client.services[servicePath].protoFilePath
		}

		const tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}.proto`)
		const ws = fs.createWriteStream(tempFilePath)

		const removeFile = () => {
			fs.unlink(tempFilePath, (_e) => {})
		}

		ws.on('error', (err) => {
			removeFile()
			callback(new Error(`Proto file download error: ${err.message}`))
		})

		call.on('error', (err) => {
			removeFile()
			ws.end()
			callback(new Error(`Proto file download error: ${err.message}`))
		})

		call.on('data', (data) => {
			ws.write(data.proto_file_chunk)
		})

		call.once('end', () => {
			ws.end()

			console.log(`${servicePath}:`)
			console.log(client)

			client.services[servicePath].protoFilePath = tempFilePath
			this.registeredServices[servicePath] = serviceId

			console.log(tempFilePath)

			callback(null, {
				success: true,
				message: 'Service successfully registered',
			})
		})
	}

	getService(call) {
		console.log({ request: call.request })
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
