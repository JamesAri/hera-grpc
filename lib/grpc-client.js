const grpc = require('@grpc/grpc-js')
const debug = require('debug')('grpc-client')

const ClientChannelOptionsInterceptor = require('./interceptors/client-channel-options')
const ClientDeadlineInterceptor = require('./interceptors/client-deadline')
const ClientMetadataInterceptor = require('./interceptors/client-metadata')
const ClientParentInterceptor = require('./interceptors/client-parent')
const ClientTracingInterceptor = require('./interceptors/client-tracing')
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

		// stateless interceptors
		this.interceptors = [
			new ClientTracingInterceptor().interceptor,
			new ClientChannelOptionsInterceptor().interceptor,
			new ClientMetadataInterceptor().interceptor,
			new ClientDeadlineInterceptor().interceptor,
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
	 * @returns Client created from stub containing the rpc methods
	 */
	createClient(clientOptions, parentCall) {
		debug(`Creating new client stub | ${this.serviceName} | [${this.connections}]`)

		let interceptors = this.interceptors

		debug(`Parent call: ${!!parentCall}`)

		interceptors = parentCall
			? [new ClientParentInterceptor(parentCall).interceptor, ...interceptors]
			: interceptors

		debug(`Client options:`, clientOptions)

		if (clientOptions && clientOptions.interceptors) {
			if (!Array.isArray(clientOptions.interceptors)) {
				throw new Error('GRPCClient - clientOptions.interceptors must be an array')
			}
			interceptors = [...interceptors, ...clientOptions.interceptors]
		}

		// Currently, you cannot explicitly attach a single connection to clients
		// for two different services. However, if you create two clients with
		// the same URL, credentials, and options (if any), they should end up
		// using the same underlying connection.
		const options = {
			...clientOptions,
			interceptors,
			'grpc.service_config': this.serviceConfigStringified, // TODO: let service owners define this
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
}
