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
		this._packageRootBundle = {}
	}

	_registerReflectionService() {
		debug('Registering reflection service', Object.keys(this._packageRootBundle))
		const reflection = new ReflectionService(this._packageRootBundle)
		reflection.addToServer(this.server)
	}

	registerService(ServiceStub, serviceHandlers, packageDefinition) {
		if (!ServiceStub) {
			throw new Error('GRPCServer - missing ServiceStub')
		}
		if (!serviceHandlers) {
			throw new Error('GRPCServer - missing service handlers')
		}
		if (typeof serviceHandlers !== 'object') {
			throw new Error(
				'GRPCServer - service handlers must be an object containing named rpc methods',
			)
		}
		if (!ServiceStub.service) {
			throw new Error('GRPCServer - ServiceStub does not have a service definition')
		}
		Object.assign(this._packageRootBundle, packageDefinition)
		this.server.addService(ServiceStub.service, serviceHandlers)
	}

	listen(hostname, port, next = () => {}) {
		this._registerReflectionService()
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
