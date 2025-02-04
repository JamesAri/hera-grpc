const grpc = require('@grpc/grpc-js')
const debug = require('debug')('grpc-client')

module.exports = class GRPCClient {

	constructor(serviceLoader) {
		const {ServiceStub, packageDefinition} = serviceLoader()
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
			debug('Closing connection')
			this.service.close()
		}
	}
}
