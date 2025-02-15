const grpc = require('@grpc/grpc-js')
const debug = require('debug')('grpc-client')

const ClientDeadlineInterceptor = require('./interceptors/client-deadline')
const ClientMetadataInterceptor = require('./interceptors/client-metadata')
const ClientParentInterceptor = require('./interceptors/client-parent')
const ClientServiceConfigInterceptor = require('./interceptors/client-service-config')

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
	constructor({ connection, serviceName, ServiceStub, packageDefinition }) {
		if (!ServiceStub) {
			throw new Error('GRPCClient - ServiceStub is required')
		}

		if (!packageDefinition) {
			throw new Error('GRPCClient - packageDefinition is required')
		}

		this.ServiceStub = ServiceStub
		this.packageDefinition = packageDefinition
		this.serviceName = serviceName
		this.connection = connection
		// stateless interceptors
		this.interceptors = [
			new ClientServiceConfigInterceptor().interceptor,
			new ClientMetadataInterceptor().interceptor,
			new ClientDeadlineInterceptor().interceptor,
		]
	}

	/**
	 * @param {*} parentCall Call object from the service handler when making a
	 * call to another service as part of the request handling.
	 * @returns Client created from stub containing the rpc methods
	 */
	createClient(parentCall) {
		debug(
			`connect - Creating client for service ${this.serviceName} with connection to ${this.connection}`,
		)

		// Currently, you cannot explicitly attach a single connection to clients
		// for two different services. However, if you create two clients with
		// the same URL, credentials, and options (if any), they should end up
		// using the same underlying connection.
		const interceptors = parentCall
			? [new ClientParentInterceptor(parentCall).interceptor, ...this.interceptors]
			: this.interceptors

		const client = new this.ServiceStub(this.connection, grpc.credentials.createInsecure(), {
			interceptors: interceptors,
		})
		this._wrapClose(client)
		return client
	}

	_wrapClose(client) {
		const close = client.close
		let closed = false
		client.close = () => {
			if (closed) {
				debug(`close - Connection to ${client.getChannel().getTarget()} already closed`)
				return
			}
			debug(`close - Closing connection to ${client.getChannel().getTarget()}`)
			close.call(client)
			closed = true
		}
	}

	setConnection(connection) {
		this.connection = connection
	}
}
