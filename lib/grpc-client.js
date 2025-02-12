const grpc = require('@grpc/grpc-js')
const debug = require('debug')('grpc-client')

const ClientMetadataInterceptor = require('./interceptors/client-metadata')
const ClientDeadlineInterceptor = require('./interceptors/client-deadline')

module.exports = class GRPCClient {

	constructor({ServiceStub, packageDefinition}) {
		if (!ServiceStub) {
			throw new Error('GRPCClient - ServiceStub is required')
		}
		if (!packageDefinition) {
			throw new Error('GRPCClient - packageDefinition is required')
		}
		this.ServiceStub = ServiceStub
		this.packageDefinition = packageDefinition
		this.service = null
		this.Metadata = grpc.Metadata
		// TODO: check order
		this.interceptors = [
			(new ClientMetadataInterceptor()).interceptor,
			(new ClientDeadlineInterceptor()).interceptor
		]
	}

	connect(host, port) {
		const connection = `${host}:${port}`

		debug(`connect - Connecting to ${connection}`)

		if (this.service) {
			debug('connect - Service already connected')
			return
		}

		this.service = new this.ServiceStub(
			connection,
			grpc.credentials.createInsecure(),
			{ interceptors: this.interceptors }
		)
	}

	close() {
		if (this.service) {
			debug('close - Closing connection to service')
			this.service.close()
			this.service = null
			return
		}
		debug('close - Connection to service already closed')
	}
}
