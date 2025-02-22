const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-interceptor:tracing')

module.exports = class ClientTracingInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
	}

	enablesTracing() {
		if (this.options.propagate_flags == null) {
			debug('Created propagation flags')
			// do not enable DEADLINE and CANCELLATION, doesn't concern this interceptor
			this.options.propagate_flags =
				grpc.propagate.DEFAULTS & ~grpc.propagate.DEADLINE & ~grpc.propagate.CANCELLATION
		}

		// we force stats and tracing context propagation (only makes sense if we use otel)
		debug('Enabling census propagation flags')
		this.options.propagate_flags |=
			grpc.propagate.CENSUS_STATS_CONTEXT | grpc.propagate.CENSUS_TRACING_CONTEXT
	}

	/**
	 * grpc.Interceptor
	 * @param {*} options
	 * @param {*} nextCall
	 * @returns {grpc.InterceptingCall}
	 */
	interceptor(options, nextCall) {
		debug(`${options?.method_definition?.path}`)

		this.options = options
		this.nextCall = nextCall
		return new grpc.InterceptingCall(nextCall(this.options))
	}
}
