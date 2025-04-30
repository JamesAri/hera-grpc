const { promisify } = require('util')

const grpc = require('@grpc/grpc-js')
const { ReflectionService } = require('@grpc/reflection')
const debug = require('debug')('grpc-server')
const { HealthImplementation } = require('grpc-health-check')

const ServerOTLPInterceptor = require('./interceptors/server-otlp')
const ServerTokenInterceptor = require('./interceptors/server-token')

/**
 * Wrapper around a gRPC server.
 *
 * It should be used to manage the connections to the clients
 * (e.g. intercepting inbound/outbound calls) and provide an
 * abstraction from the gRPC dependency.
 */
module.exports = class GRPCServer {
	/**
	 * @param {grpc.ServerOptions} serverOptions options for gRPC server
	 */
	constructor(serverOptions) {
		this.listening = false
		this._packageRootBundle = {}

		this.interceptors = [
			new ServerOTLPInterceptor().interceptor,
			new ServerTokenInterceptor().interceptor,
		]

		if (serverOptions && serverOptions.interceptors) {
			if (!Array.isArray(serverOptions.interceptors)) {
				throw new Error('GRPCServer - interceptors must be an array')
			}
			this.interceptors.push(...serverOptions.interceptors)
		}

		const options = {
			...serverOptions,
			interceptors: this.interceptors,
		}

		this.server = new grpc.Server(options)
		this.server.bindAsync = promisify(this.server.bindAsync)

		this.server.tryShutdownPromisified = promisify(this.server.tryShutdown)
	}

	async tryShutdown() {
		await this.server.tryShutdownPromisified()
		this.listening = false
	}

	forceShutdown() {
		this.server.forceShutdown()
		this.listening = false
	}

	isListening() {
		return this.listening
	}

	/**
	 * Register the health service to the server.
	 *
	 * This will allow clients to check the health of the server,
	 * not the health of the services.
	 */
	_registerHealthService() {
		const statusMap = {
			'': 'SERVING',
		}
		const healthImpl = new HealthImplementation(statusMap)
		healthImpl.addToServer(this.server)
		debug('Health service registered')
	}

	/**
	 * Register the reflection service to the server.
	 *
	 * This will allow clients to discover the services
	 * and methods available on the server via reflection
	 * protocol.
	 */
	_registerReflectionService() {
		debug('Registering reflection service', Object.keys(this._packageRootBundle))
		const reflection = new ReflectionService(this._packageRootBundle)
		reflection.addToServer(this.server)
		debug('Reflection service registered')
	}

	/**
	 * Register a service to the server and add it to the global
	 * package root bundle.
	 *
	 * @param {grpc.ServiceDefinition} ServiceStub
	 * @param {grpc.UntypedServiceImplementation} serviceHandlers
	 * @param {protoLoader.PackageDefinition} packageDefinition
	 */
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

	/**
	 * @param {string} hostname
	 * @param {number|string} port
	 * @returns {number} boundPort
	 */
	async listen(hostname, port) {
		this._registerHealthService()
		this._registerReflectionService()
		const connection = `${hostname}:${port}`
		const credentials = grpc.ServerCredentials.createInsecure()

		try {
			const boundPort = await this.server.bindAsync(connection, credentials)
			debug(`Server running at http://${hostname}:${boundPort}`)
			this.listening = true
			return boundPort
		} catch (error) {
			debug('Error binding server', error)
			throw error
		}
	}
}
