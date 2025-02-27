const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-interceptor:channel-options')

const config = require('../config')
const { setDefaultMetadataValue } = require('../utils')

module.exports = class ClientChannelOptionsInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
	}

	start(metadata, listener, next) {
		debug('before:', metadata)

		// eslint-disable-next-line prettier/prettier
		setDefaultMetadataValue(
			metadata,
			'grpc.enable_channelz',
			config.channelOptions.enableChannelz
		)

		setDefaultMetadataValue(
			metadata,
			'grpc.default_compression_level',
			config.channelOptions.defaultCompressionLevel,
		)

		setDefaultMetadataValue(
			metadata,
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
