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
	}

	connect(host, port) {
		debug(`Connecting to ${host}:${port}`)
		this.service = new this.ServiceStub(`${host}:${port}`, grpc.credentials.createInsecure())
	}

	close() {
		if (this.service) {
		 	debug('Closing connection to service')
			this.service.close()
		}
	}
}
