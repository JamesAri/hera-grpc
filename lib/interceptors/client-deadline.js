const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-deadline-interceptor')

const config = require('../config')

module.exports = class ClientDeadlineInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
	}

	/**
	 * A deadline is used to specify a point in time past which a client
	 * is unwilling to wait for a response from a server. This simple idea
	 * is very important in building robust distributed systems.
	 *
	 * Server might need to call another server to produce a response.
	 * In these cases where your server also acts as a client you would
	 * want to honor the deadline set by the original client. That is
	 * achieved by propagating the parent and setting the respective
	 * propagate flags.
	 *
	 * @see https://grpc.io/docs/guides/deadlines/
	 */
	addDefaultDeadline() {
		if (this.options.parent && this.options.propagate_flags & grpc.propagate.DEADLINE) {
			debug('Propagating parent call deadline, passed deadline (if any) will be ignored')
			// NOTE: if user specified deadline, we will override it,
			// because it wouldn't make sense to not propagate the parent deadline.
			delete this.options.deadline // NOTE: parent's deadline in: this.options.parent.getDeadline()
			return
		}

		// user doesn't wish to set a deadline => infinite deadline
		// TODO: let service owners decide (when we have service configs in zk)
		if (
			this.options.deadline === null ||
			(typeof this.options.deadline === 'number' && this.options.deadline <= 0)
		) {
			debug('Requested infinite deadline')
			this.options.deadline = undefined
			return
		}

		if (!this.options.deadline) {
			// user hasn't set a deadline - add default deadline
			const deadline = new Date()
			deadline.setSeconds(deadline.getSeconds() + config.timeouts.callDeadline)
			this.options.deadline = deadline
			debug(`Adding default deadline of ${config.timeouts.callDeadline} seconds: ${deadline}`)
		} else {
			// user has set a deadline - either a number or a date
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
		debug(`${options?.method_definition?.path} deadline: ${options.deadline}`)

		this.options = options
		this.nextCall = nextCall

		this.addDefaultDeadline()

		return new grpc.InterceptingCall(nextCall(this.options))
	}
}
