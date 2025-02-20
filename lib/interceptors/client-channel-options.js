const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-channel-options-interceptor')

const config = require('../config')

module.exports = class ClientChannelOptionsInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
	}

	start(metadata, listener, next) {
		debug('before:', metadata)
		// TODO: create separate metadata-options interceptor for wait-for-ready?
		metadata.setOptions({ waitForReady: config.metadataOptions.waitForReady })
		metadata.set('grpc.enable_channelz', config.channelOptions.enableChannelz)
		metadata.set('grpc.default_compression_level', config.channelOptions.defaultCompressionLevel)
		metadata.set(
			'grpc.default_compression_algorithm',
			config.channelOptions.defaultCompressionAlgorithm,
		)
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
