const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-interceptor:metadata-options')

const config = require('../config')
const { setDefaultMetadataOptions } = require('../utils')

/**
 * Interceptor for setting default metadata options which modify the
 * RPC behavior.
 */
module.exports = class ClientMetadataOptionsInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
	}

	start(metadata, listener, next) {
		debug('before:', metadata)

		setDefaultMetadataOptions(metadata, 'waitForReady', config.metadataOptions.waitForReady)

		debug('after:', metadata)
		next(metadata, listener)
	}

	/**
	 * grpc.Interceptor
	 * @param {grpc.InterceptorOptions} options
	 * @param {grpc.NextCall} nextCall
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
