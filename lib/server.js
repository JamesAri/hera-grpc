const grpc = require('@grpc/grpc-js')

module.exports = class GRPCServer {

	constructor(ServiceStubConstructor, serviceHandlers) {
		this.server = new grpc.Server()
		this.server.addService(ServiceStubConstructor.service, serviceHandlers)
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
