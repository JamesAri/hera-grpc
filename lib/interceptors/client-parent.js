const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-interceptor:parent')

module.exports = class ClientParentInterceptor {
	constructor(parentCall) {
		this.interceptor = this.interceptor.bind(this)
		this.parentCall = parentCall
	}

	addParentCall() {
		if (!this.options.parent) {
			debug('Adding parent call')
			this.options.parent = this.parentCall
		}

		if (this.options.propagate_flags == null) {
			debug('Propagation flags were not defined')
			// do not enable stats and tracing context propagation, doesn't concern this interceptor
			this.options.propagate_flags =
				grpc.propagate.DEFAULTS &
				~grpc.propagate.CENSUS_STATS_CONTEXT &
				~grpc.propagate.CENSUS_TRACING_CONTEXT
		}

		// we force deadline and cancellation propagation
		debug('Enabling deadline and cancellation propagation flags')
		this.options.propagate_flags |= grpc.propagate.DEADLINE | grpc.propagate.CANCELLATION
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

		this.addParentCall()
		return new grpc.InterceptingCall(nextCall(this.options))
	}
}
