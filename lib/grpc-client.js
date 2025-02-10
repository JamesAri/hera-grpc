const grpc = require('@grpc/grpc-js')
const debug = require('debug')('grpc-client')

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
		this.grpc = grpc
	}

	connect(host, port) {
		debug(`connect - Connecting to ${host}:${port}`)
		if (this.service) {
			debug('connect - Service already connected')
			return
		}
		this.service = new this.ServiceStub(`${host}:${port}`, grpc.credentials.createInsecure())
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
