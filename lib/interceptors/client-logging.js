const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-logging-interceptor')

module.exports = class ClientLoggingInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
	}

	/**
	 * grpc.Interceptor
	 * @param {*} options
	 * @param {*} nextCall
	 * @returns {grpc.InterceptingCall}
	 */
	interceptor(options, nextCall) {
		debug(`Path: ${options?.method_definition?.path}`)
		// debug(`Call name: ${options?.method_descriptor?.name}`)
		// debug(`Service name: ${options?.method_descriptor?.service_name}`)
		// debug(`Method type: ${options?.method_descriptor?.method_type}`)
		// debug(`Server to call: ${options?.host}`)

		this.options = options
		this.nextCall = nextCall
		return new grpc.InterceptingCall(nextCall(this.options))
	}
}
