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
		if (this.options.deadline != null && this.options.deadline <= 0) {
			debug('Requested infinite deadline')
			return
		}
		if (!this.options.deadline) {
			const deadline = new Date()
			deadline.setSeconds(deadline.getSeconds() + config.timeouts.client_deadline)
			this.options.deadline = deadline
			debug(`Adding default deadline of ${config.timeouts.client_deadline} seconds: ${deadline}`)
		} else {
			debug(`Deadline set to ${this.options.deadline}`)
		}
	}

	/**
	 * grpc.Interceptor
	 * @param {*} options
	 * @param {*} nextCall
	 * @returns {grpc.InterceptingCall}
	 */
	interceptor(options, nextCall) {
		debug(new Date(), `${options?.method_definition?.path} deadline: ${options.deadline}`)

		this.options = options
		this.nextCall = nextCall

		this.addDefaultDeadline()

		return new grpc.InterceptingCall(nextCall(this.options))
	}
}
