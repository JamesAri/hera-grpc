const grpc = require('@grpc/grpc-js')
const debug = require('debug')('grpc-client')

const {
	ClientChannelOptionsInterceptor,
	ClientMetadataOptionsInterceptor,
	ClientDeadlineInterceptor,
	ClientParentInterceptor,
	ClientTokenInterceptor,
	ClientTracingInterceptor,
} = require('./interceptors')
const serviceConfig = require('./service-config')
const { shuffle } = require('./utils')

/**
 * Wrapper around a gRPC client. Represents a remote service we can connect to.
 *
 * It should be used to manage the connection to the server like
 * intercepting calls, adding hooks on the gRPC client methods
 * and provide an abstraction from the gRPC dependency.
 *
 * All operations on the gRPC client should be done through interceptors/hooks.
 */
module.exports = class GRPCClient {
	constructor({ route, connections, serviceName, ServiceStub, packageDefinition }) {
		if (!ServiceStub) {
			throw new Error('GRPCClient - ServiceStub is required')
		}

		if (!packageDefinition) {
			throw new Error('GRPCClient - packageDefinition is required')
		}

		this.route = route
		this.ServiceStub = ServiceStub
		this.packageDefinition = packageDefinition
		this.serviceName = serviceName

		// list of host:port connections
		this.connections = connections || []

		// stateless interceptors {priority: interceptor}
		this.interceptors = [
			{ 100: new ClientTracingInterceptor(this.route) },
			{ 200: new ClientMetadataOptionsInterceptor() },
			{ 300: new ClientChannelOptionsInterceptor() },
			{ 400: new ClientTokenInterceptor() },
			{ 500: new ClientDeadlineInterceptor() },
		]
		this.serviceConfigStringified = JSON.stringify(serviceConfig)

		debug(`ctor - GRPCClient | ${this.route} | ${this.serviceName} | [${this.connections}]`)
	}

	/**
	 * @see https://github.com/grpc/grpc/blob/master/doc/naming.md
	 */
	getConnectionList() {
		// shuffle => round-robin from the first connection in the list
		return 'ipv4:' + shuffle(this.connections).join(',') // TODO: change protocol
	}

	/**
	 * @param {*} clientOptions Options to pass to the client constructor
	 * @param {*} parentCall Call object from the service handler when making a
	 * call to another service as part of the request handling.
	 * @returns Client stub containing the rpc methods
	 */
	createStub(clientOptions, parentCall) {
		debug(`Creating new client stub | ${this.serviceName} | [${this.connections}]`)

		debug(`Parent call: ${!!parentCall}`)
		debug(`Client options:`, clientOptions)

		let interceptors = this.interceptors

		if (parentCall) {
			interceptors = [{ 150: new ClientParentInterceptor(parentCall) }, ...interceptors]
		}

		interceptors = interceptors
			.sort((a, b) => Object.keys(a)[0] - Object.keys(b)[0])
			.map((i) => Object.values(i)[0].interceptor)

		if (clientOptions && clientOptions.interceptors) {
			if (!Array.isArray(clientOptions.interceptors)) {
				throw new Error('GRPCClient - clientOptions.interceptors must be an array')
			}
			interceptors = [...clientOptions.interceptors, ...interceptors]
		}

		// Currently, you cannot explicitly attach a single connection to clients
		// for two different services. However, if you create two clients with
		// the same URL, credentials, and options (if any), they should end up
		// using the same underlying connection.
		//
		// Interceptors are not considered when determining whether to reuse connections.
		// More generally, any option in ClientOptions but not ChannelOptions either is not
		// considered for channel reuse or overrides channel construction entirely.
		const options = {
			// TODO: test defining interceptors in clientOptions
			...clientOptions,
			interceptors,
			// TODO: let service owners define this and register it in zk along with the service meta
			'grpc.service_config': this.serviceConfigStringified,
		}

		// NOTE: It is up to the users to reuse the client! (which they should)
		// We don't know when the client will be closed, so it's generally not
		// safe to reuse it and it should be left to the users implementation.
		const client = new this.ServiceStub(
			this.getConnectionList(),
			grpc.credentials.createInsecure(), // TODO
			options,
		)

		this._wrapClose(client)

		return client
	}

	/**
	 * @returns {Array<string>} list of host:port connections
	 */
	getConnections() {
		return this.connections
	}

	/**
	 * @param {Array<string>} connections list of host:port connections
	 */
	setConnections(connections) {
		this.connections = connections
	}

	/**
	 * TODO: delete - just for debugging reasons atm
	 */
	_wrapClose(client) {
		const close = client.close
		let closed = false
		client.close = () => {
			if (closed) {
				debug(`close - connection to ${client.getChannel().getTarget()} already closed`)
				return
			}
			debug(`close - closing connection to ${client.getChannel().getTarget()}`)
			close.call(client)
			closed = true
		}
	}
}
