const grpc = require('@grpc/grpc-js')
const { ReflectionService } = require('@grpc/reflection')

module.exports = class GRPCServer {

	constructor() {
		this.server = new grpc.Server()
	}

	_registerReflectionService() {
		const reflection = new ReflectionService(/** how to get bundled package definition for all services? */)
		reflection.addToServer(this.server)
	}

	registerService(serviceLoader, serviceHandlers) {
		const {serviceStub} = serviceLoader()
		this.server.addService(serviceStub.service, serviceHandlers)
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
