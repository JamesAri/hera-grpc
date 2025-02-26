const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-interceptor:tracing')

const APP_NAME = `${process.env.APP_NAME}-${process.pid}` // TODO

module.exports = class ClientTracingInterceptor {
	constructor(route) {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
		this.route = route
	}

	start(metadata, listener, next) {
		debug('before:', metadata)

		if (this.options.parent) {
			let forwardedFor = this.options.parent.metadata?.get('hera-forwarded-for')?.[0]
			forwardedFor = forwardedFor ? `${forwardedFor} ${APP_NAME}` : APP_NAME
			metadata.set('hera-forwarded-for', forwardedFor)
		} else {
			metadata.set('hera-forwarded-for', APP_NAME)
		}

		metadata.set('hera-route', this.route)

		debug('after:', metadata)
		next(metadata, listener)
	}

	enableTracing() {
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

		this.enableTracing()

		// prettier-ignore
		this.requester = (new grpc.RequesterBuilder())
			.withStart(this.start)
			.build()

		return new grpc.InterceptingCall(nextCall(this.options), this.requester)
	}
}
