const grpc = require('@grpc/grpc-js')
const config = require('../config')
const debug = require('debug')('client-deadline-interceptor')

module.exports = class ClientDeadlineInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.start = this.start.bind(this)
	}

	start(metadata, listener, next) {
		metadata.set('authorization', 'L3tM3In')
		next(metadata, listener)
	}

	addDefaultDeadline() {
		if (this.options.deadline === undefined) {
			const deadline = new Date()
			deadline.setSeconds(deadline.getSeconds() + config.timeouts.client_deadline)
			this.options.deadline = deadline
		}
	}

	/**
	 * grpc.Interceptor
	 * @param {*} options
	 * @param {*} nextCall
	 * @returns {grpc.InterceptingCall}
	 */
	interceptor(options, nextCall) {
		debug(new Date())

		this.options = options
		this.nextCall = nextCall

		this.addDefaultDeadline()

		return new grpc.InterceptingCall(nextCall(this.options))
	}
}
