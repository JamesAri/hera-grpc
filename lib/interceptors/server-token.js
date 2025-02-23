const grpc = require('@grpc/grpc-js')
const debug = require('debug')('server-interceptor:token')

const RPC_WHITE_LIST = ['/grpc.health.v1.Health/Check', `/grpc.health.v1.Health/Watch`]

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
module.exports = class ServerTokenInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.onReceiveMetadata = this.onReceiveMetadata.bind(this)
		this.start = this.start.bind(this)
	}

	onReceiveMetadata(metadata, next) {
		// TODO: refactor
		if (
			metadata.get('hera-token')?.[0] !== 'L3tM3In' &&
			!RPC_WHITE_LIST.includes(this.methodDescriptor.path)
		) {
			this.nextCall.sendStatus({
				code: grpc.status.UNAUTHENTICATED,
				details: 'Auth metadata not correct',
			})
			return
		}

		next(metadata)
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
		debug(`client peer: ${nextCall.getPeer && nextCall.getPeer()}`)

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
