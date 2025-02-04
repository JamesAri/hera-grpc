class AppError extends Error {
	constructor(opts) {
		super(opts.message)
		this.name = this.constructor.name
		this.message = opts.message
	}
}

class MissingSessionIdError extends AppError {
	constructor(opts) {
		const error = {
			message: 'No session id provided',
		}
		super(Object.assign(error, opts))
	}
}

class ServiceRouterError extends AppError {
	constructor(opts) {
		const error = {
			message: `Service router error: ${opts.error?.message}`,

		}
		super(Object.assign(error, opts))
	}
}


module.exports = {
	MissingSessionIdError,
	ServiceRouterError,
}
