const grpc = require('@grpc/grpc-js')
const { ReflectionService } = require('@grpc/reflection')

const debug = require('debug')('grpc-server')

module.exports = class GRPCServer{

	constructor() {
		this.server = new grpc.Server()
	}

	_registerReflectionService() {
		const reflection = new ReflectionService(/* how to get bundled package definition for all services? */)
		reflection.addToServer(this.server)
	}

	registerService(ServiceStub, serviceHandlers) {
		if (!ServiceStub) {
			throw new Error('GRPCServer - ServiceStub is required')
		}
		if (!serviceHandlers) {
			throw new Error('GRPCServer - serviceHandlers are required')
		}
		if (typeof serviceHandlers !== 'object') {
			throw new Error('GRPCServer - service handlers must be an object containing named rpc methods')
		}
		if (!ServiceStub.service) {
			throw new Error('GRPCServer - ServiceStub does not have a service definition')
		}
		this.server.addService(ServiceStub.service, serviceHandlers)
	}

	tryShutdown(cb) {
		this.server.tryShutdown(cb)
	}

	forceShutdown(cb) {
		this.server.forceShutdown(cb)
	}

	listen(hostname, port, next = () => {}) {
		this.server.bindAsync(`${hostname}:${port}`, grpc.ServerCredentials.createInsecure(), (error, port) => {
			if (error) {
				next(error)
				return
			}
			debug(`Server running at http://${hostname}:${port}`)
			next(null)
		})
	}
}
