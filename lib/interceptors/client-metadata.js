const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-interceptor:metadata')

/**
 * Metadata is information about a particular RPC call (such as
 * authentication details) in the form of a list of key-value pairs,
 * where the keys are strings and the values are typically strings,
 * but can be binary data.
 *
 * Keys are case insensitive and consist of ASCII letters, digits, and
 * special characters -, _, . and must not start with grpc- (which is
 * reserved for gRPC itself). Binary-valued keys end in -bin while
 * ASCII-valued keys do not.
 */
module.exports = class ClientMetadataInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
	}

	start(metadata, listener, next) {
		debug('before:', metadata)
		metadata.set('hera-authorization', 'L3tM3In') // TODO: remove - demonstrate in postman
		debug('after:', metadata)
		next(metadata, listener)
	}

	/**
	 * grpc.Interceptor
	 * @param {*} options
	 * @param {*} nextCall
	 * @returns {grpc.InterceptingCall}
	 */
	interceptor(options, nextCall) {
		debug(options?.method_definition?.path)

		this.options = options
		this.nextCall = nextCall

		// prettier-ignore
		this.requester = (new grpc.RequesterBuilder())
			.withStart(this.start)
			.build()
		return new grpc.InterceptingCall(nextCall(this.options), this.requester)
	}
}
