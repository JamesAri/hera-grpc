const grpc = require('@grpc/grpc-js')
const { ReflectionService } = require('@grpc/reflection')
const debug = require('debug')('grpc-server')
const { HealthImplementation } = require('grpc-health-check')

const ServerTokenInterceptor = require('./interceptors/server-token')

/**
 * Wrapper around a gRPC server.
 *
 * It should be used to manage the connections to the clients
 * (e.g. intercepting inbound/outbound calls) and provide an
 * abstraction from the gRPC dependency.
 */
module.exports = class GRPCServer {
	constructor(serverOptions) {
		const interceptors = [new ServerTokenInterceptor().interceptor]

		// TODO: test
		if (serverOptions && serverOptions.interceptors) {
			if (!Array.isArray(serverOptions.interceptors)) {
				throw new Error('GRPCServer - interceptors must be an array')
			}
			interceptors.push(...serverOptions.interceptors)
		}

		const options = {
			...serverOptions,
			interceptors,
		}

		this.server = new grpc.Server(options)
		this.listening = false
		this._packageRootBundle = {}
	}

	// TODO: Use when they fix gdebug- https://github.com/grpc/grpc-experiments/tree/master/gdebug
	_registerChannelzService() {
		const channelzHandlers = grpc.getChannelzHandlers()
		const channelzServiceDefinition = grpc.getChannelzServiceDefinition()
		this.server.addService(channelzServiceDefinition, channelzHandlers)
		debug('Channelz service registered')
	}

	_registerHealthService() {
		const statusMap = {
			'': 'SERVING',
		}
		const healthImpl = new HealthImplementation(statusMap)
		healthImpl.addToServer(this.server)
		debug('Health service registered')
	}

	_registerReflectionService() {
		debug('Registering reflection service', Object.keys(this._packageRootBundle))
		const reflection = new ReflectionService(this._packageRootBundle)
		reflection.addToServer(this.server)
		debug('Reflection service registered')
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
		this._registerHealthService()
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

	isListening() {
		return this.listening
	}
}
