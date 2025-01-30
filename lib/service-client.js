const grpc = require('@grpc/grpc-js')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('node:crypto')
const { Transform } = require('node:stream')
const EventEmitter = require('node:events').EventEmitter

const { getPackageDefinition, getServiceStub } = require('./utils')
const Chat = require('../demo/grpc/client/chat/chat')
const GRPCClient = require('./grpc-client')
const { loadServiceFactory } = require('./utils')
const serviceDiscoveryConfig = require('./proto/service-discovery-config')
const { action } = require('./constants')

const transformToGrpcMessage = new Transform({
	objectMode: true,
	transform(chunk, _encoding, callback) {
		callback(null, { proto_file_chunk: chunk })
	},
})

module.exports = class ServiceClient extends EventEmitter {
	constructor(options = {}) {
		super()
		this.remoteServices = {}
		this.host = options.host
		this.port = options.port
		this.stream = null
		this.id = null

		this.client = new GRPCClient(loadServiceFactory(serviceDiscoveryConfig))
		this.client.connect('localhost', 50051) // TODO: take from env
	}

	is_connected() {
		return this.stream !== null && this.id !== null
	}

	_write(action, data) {
		if (!this.is_connected) {
			this.emit('error', new Error('Client must call createSession first'))
			return
		}
		this.stream.write({ action, ...data })
	}

	_error(error) {
		this._write(action.ERROR, { error: { message: error.message } })
		this.emit('error', error)
	}

	_connect() {
		this._write(action.CONNECT, {
			client_id: this.id,
			connection: {
				host: this.host,
				port: this.port,
			},
		})
	}

	createSession() {
		this.stream = this.client.service.createSession()

		this.stream.on('metadata', (meta) => {
			const headers = meta.getMap()

			if (!headers['x-session-id']) {
				this._error(new Error('No session id provided'))
				this.stream.end()
				return
			}
			this.id = headers['x-session-id']
			this._connect()
		})

		this.stream.on('data', (data) => {
			switch (data.action) {
			case action.CONNECT:
				this._connect() // not used now, could be used for server to request update?
				break
			case action.CONNECTED:
				console.log('Connected to the service router')
				this.emit('connected')
				break
			case action.ERROR:
				this.emit('error', new Error(`Service router error: ${data.error.message}`))
				this.stream.end()
				break
			default:
				this.emit('error', new Error(`Unknown action received: ${data.action}`))
			}
		})

		this.stream.on('end', () => {
			console.log(`Stream event ${this.id} - end`)
			this.stream.end() // ?
			this.stream = null // ?
		})

		this.stream.on('close', () => {
			console.log(`Stream event ${this.id} - close`)
			this.emit('close')
		})

		this.stream.on('status', (status) => {
			console.log('Status:', status)
		})

		this.stream.on('error', (err) => {
			this.emit('error', new Error(`Service router error: ${err.message}`))
			this.stream.end()
		})
	}

	cleanup() {
		console.log('Cleaning up')
		for (const serviceId in this.remoteServices) {
			const service = this.remoteServices[serviceId]
			if (service.protoFilePath) {
				console.log('removing proto file', service.protoFilePath)
				fs.unlink(service.protoFilePath, (_e) => {})
			}
		}
	}

	registerService(protoFile, path) {
		if (!this.is_connected()) {
			this.emit('error', new Error('Client must call createSession first'))
			return
		}

		const metadata = new grpc.Metadata()
		metadata.add('x-path', path)
		metadata.add('x-session-id', this.id)

		const call = this.client.service.registerService(metadata, (error, res) => {
			if (error) {
				console.log('Broker ', error)
				return
			}
			console.log({ res })
		})

		const rs = fs.createReadStream(protoFile)
		rs.pipe(transformToGrpcMessage).pipe(call)
	}

	_callRemoteService(servicePath) {
		const packageDefinition = getPackageDefinition({
			protoPath: this.remoteServices[servicePath].protoFilePath,
			loadOptions: {
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
		})
		const ServiceStub = getServiceStub(packageDefinition, 'ChatRoom')
		const { host, port } = this.remoteServices[servicePath].connection

		console.log(`Connecting to ${host}:${port}`)
		const service = new ServiceStub(`${host}:${port}`, grpc.credentials.createInsecure())
		const chat = new Chat({ service: service })
		chat.start()

		console.log('CALLING REMOTE HC SERVICE:', this.remoteServices[servicePath])
	}

	callService(request) {
		console.log({ out: { ...request, client_id: this.id } })
		const call = this.client.service.getService({ ...request, client_id: this.id })

		// TODO: test if request.path is always present
		if (!this.remoteServices[request.path]) {
			this.remoteServices[request.path] = {}
		}

		let error = null
		let meta = null
		const data = []

		call.on('data', (dataResponse) => {
			data.push(dataResponse.proto_file_chunk)
		})

		call.on('error', (err) => {
			error = err
		})

		call.on('metadata', (metadata) => {
			meta = metadata
		})

		call.on('end', () => {
			if (error) {
				delete this.remoteServices[request.path]
				console.error('SERVER RETURNER ERROR:\n', error)
				return
			}

			// if (request.refetch_proto_file) {
			if (this.remoteServices[request.path].protoFilePath) {
				fs.unlink(this.remoteServices[request.path].protoFilePath, (_e) => {})
				delete this.remoteServices[request.path].protoFilePath
			}
			const tempFilePath = path.join(os.tmpdir(), `${crypto.randomUUID()}.proto`)
			const ws = fs.createWriteStream(tempFilePath)

			for (const chunk of data) {
				ws.write(chunk)
			}
			ws.end()
			this.remoteServices[request.path].protoFilePath = tempFilePath
			console.log('Temp file path: ', tempFilePath)
			// }

			ws.on('close', () => {
				let connection = meta.get('x-connection')
				if (!connection.length) {
					console.error('Connection not provided')
				}
				connection = connection[0].split(':')
				connection = {
					host: connection[0],
					port: connection[1],
				}

				this.remoteServices[request.path].connection = connection

				this._callRemoteService(request.path)
				// this.emit('close')
			})
		})
	}
}
