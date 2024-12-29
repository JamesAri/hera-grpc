const grpc = require('@grpc/grpc-js')
const { ReflectionService } = require('@grpc/reflection')

module.exports = class GRPCServer {

	constructor(serviceLoader, serviceHandlers) {
		const {serviceStub, packageDefinition} = serviceLoader()
		this.serviceStub = serviceStub
		this.packageDefinition = packageDefinition

		this.server = new grpc.Server()
		this.server.addService(this.serviceStub.service, serviceHandlers)

		this._registerReflectionService()
	}

	_registerReflectionService() {
		const reflection = new ReflectionService(this.packageDefinition)
		reflection.addToServer(this.server)
	}

	listen(hostname, port) {
		this.server.bindAsync(`${hostname}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
			if (error) {
				console.error(`Server binding failed: ${error.message}`)
				return
			}
			console.log(`Server running at http://${hostname}:${port}`)
		})
	}
}
