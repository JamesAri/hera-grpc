const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-metadata-interceptor')

module.exports = class ClientMetadataInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
	}

	start(metadata, listener, next) {
		metadata.set('authorization', 'L3tM3In')
		next(metadata, listener)
	}

	/**
	 * grpc.Interceptor
	 * @param {*} options
	 * @param {*} nextCall
	 * @returns {grpc.InterceptingCall}
	 */
	interceptor(options, nextCall) {
		debug(new Date(), options?.method_definition?.path)

		this.options = options
		this.nextCall = nextCall

		this.requester = new grpc.RequesterBuilder()
			.withStart(this.start)
			.build()
		return new grpc.InterceptingCall(nextCall(this.options), this.requester)
	}
}
