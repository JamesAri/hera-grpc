const grpc = require('@grpc/grpc-js')
const debug = require('debug')('server-metadata-interceptor')

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
module.exports = class ServerMetadataInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.onReceiveMetadata = this.onReceiveMetadata.bind(this)
		this.start = this.start.bind(this)
	}

	onReceiveMetadata(metadata, next) {
		if (metadata.get('authorization')?.[0] !== 'L3tM3In') {
			this.nextCall.sendStatus({
				code: grpc.status.UNAUTHENTICATED,
				details: 'Auth metadata not correct',
			})
		} else {
			next(metadata)
		}
	}

	start(next) {
		return next(this.listener)
	}

	/**
	 * grpc.ServerInterceptor
	 * @returns {grpc.ServerInterceptingCall}
	 */
	interceptor(methodDescriptor, nextCall) {
		debug(methodDescriptor.path)

		this.methodDescriptor = methodDescriptor
		this.nextCall = nextCall

		// prettier-ignore
		this.listener = (new grpc.ServerListenerBuilder())
			.withOnReceiveMetadata(this.onReceiveMetadata)
			.build()

		// prettier-ignore
		this.responder = (new grpc.ResponderBuilder())
			.withStart(this.start)
			.build()

		return new grpc.ServerInterceptingCall(this.nextCall, this.responder)
	}
}
