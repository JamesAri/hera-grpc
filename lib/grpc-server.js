const grpc = require('@grpc/grpc-js')
const { ReflectionService } = require('@grpc/reflection')

const debug = require('debug')('grpc-server')

// TODO: extend grpc Server
module.exports = class GRPCServer{

	constructor() {
		this.server = new grpc.Server()
	}

	_registerReflectionService() {
		const reflection = new ReflectionService(/** how to get bundled package definition for all services? */)
		reflection.addToServer(this.server)
	}

	registerService(serviceLoader, serviceHandlers) {
		const {ServiceStub} = serviceLoader()
		this.server.addService(ServiceStub.service, serviceHandlers)
	}

	tryShutdown(cb) {
		this.server.tryShutdown(cb)
	}

	forceShutdown(cb) {
		this.server.forceShutdown(cb)
	}

	listen(hostname, port) {
		this.server.bindAsync(`${hostname}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
			if (error) {
				console.error(`Server binding failed: ${error.message}`)
				return
			}
			debug(`Server running at http://${hostname}:${port}`)
		})
	}
}
