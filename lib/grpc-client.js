const grpc = require('@grpc/grpc-js')
const debug = require('debug')('grpc-client')

const ClientMetadataInterceptor = require('./interceptors/client-metadata')
const ClientDeadlineInterceptor = require('./interceptors/client-deadline')

module.exports = class GRPCClient {
	constructor({ host, port, ServiceStub, packageDefinition }) {
		if (!ServiceStub) {
			throw new Error('GRPCClient - ServiceStub is required')
		}

		if (!packageDefinition) {
			throw new Error('GRPCClient - packageDefinition is required')
		}

		this.ServiceStub = ServiceStub
		this.packageDefinition = packageDefinition

		this.interceptors = [new ClientMetadataInterceptor().interceptor, new ClientDeadlineInterceptor().interceptor]

		this.host = host
		this.port = port
		this.connection = `${host}:${port}`
		this.client = null
	}

	connect() {
		if (this.client) {
			debug(`connect - Client already connected to ${this.connection}, reusing`)
			return
		}

		debug(`connect - Connecting to ${this.connection}`)

		this.client = new this.ServiceStub(
			this.connection,
			grpc.credentials.createInsecure(),
			{ interceptors: this.interceptors},
		)
		this._wrapClose()
	}

	_wrapClose() {
		const close = this.client.close

		this.client.close = () => {
			if (!this.client) {
				debug(`close - Connection to ${this.connection} already closed`)
				return
			}

			debug(`close - Closing connection to ${this.connection}`)

			close.call(this.client)
			delete this.client
		}
	}

	close() {
		this.client.close()
	}

	getClient() {
		return this.client
	}
}
