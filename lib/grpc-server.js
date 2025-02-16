const grpc = require('@grpc/grpc-js')
const { ReflectionService } = require('@grpc/reflection')
const debug = require('debug')('grpc-server')

const ServerMetadataInterceptor = require('./interceptors/server-metadata')

/**
 * Wrapper around a gRPC server.
 *
 * It should be used to manage the connections to the clients
 * (e.g. intercepting inbound/outbound calls) and provide an
 * abstraction from the gRPC dependency.
 *
 */
module.exports = class GRPCServer {
	constructor() {
		const interceptors = [new ServerMetadataInterceptor().interceptor]
		this.server = new grpc.Server({ interceptors })
		this.listening = false
	}

	_registerReflectionService() {
		const reflection =
			new ReflectionService(/* how to get bundled package definition for all services? */)
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
			throw new Error(
				'GRPCServer - service handlers must be an object containing named rpc methods',
			)
		}
		if (!ServiceStub.service) {
			throw new Error('GRPCServer - ServiceStub does not have a service definition')
		}
		this.server.addService(ServiceStub.service, serviceHandlers)
	}

	listen(hostname, port, next = () => {}) {
		const connection = `${hostname}:${port}`
		const credentials = grpc.ServerCredentials.createInsecure()
		this.server.bindAsync(connection, credentials, (error, boundPort) => {
			if (error) {
				next(error, boundPort)
				return
			}
			this.listening = true
			debug(`Server running at http://${hostname}:${boundPort}`)
			next(null, boundPort)
		})
	}
}
