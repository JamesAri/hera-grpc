const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-metadata-interceptor')

module.exports = class ClientMetadataInterceptor {
	constructor(parentCall) {
		this.interceptor = this.interceptor.bind(this)
		this.parentCall = parentCall
	}

	addParentCall() {
		// note: we should write propagation masks as deltas from the default
		// e.g.: (DEFAULTS & ~DEADLINE) to disable deadline propagation

		if (this.options.propagate_flags == null) {
			this.options.propagate_flags = grpc.propagate.DEFAULTS
		}

		// we force deadline propagation
		if (this.options.propagate_flags & grpc.propagate.DEADLINE) {
			this.options.propagate_flags |= grpc.propagate.DEADLINE
		}

		// we force cancellation propagation
		if (this.options.propagate_flags & grpc.propagate.CANCELLATION) {
			this.options.propagate_flags |= grpc.propagate.CANCELLATION
		}

		if (!this.options.parent) {
			debug('Adding parent call')
			this.options.parent = this.parentCall
		}
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

		this.addParentCall()
		return new grpc.InterceptingCall(nextCall(this.options), this.requester)
	}
}
