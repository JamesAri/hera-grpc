const grpc = require('@grpc/grpc-js')

module.exports = class GRPCClient {

	constructor(serviceLoader) {
		const {serviceStub, packageDefinition} = serviceLoader()
		this.serviceStub = serviceStub
		this.packageDefinition = packageDefinition
		this.service = null
	}

	connect(host, port) {
		console.log(`Connecting to ${host}:${port}`)
		this.service = new this.serviceStub(`${host}:${port}`, grpc.credentials.createInsecure())
	}
}
