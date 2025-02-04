const config = require('./config')

module.exports = (part) => {
	const logger = {}
	part = part ? `:${part}` : ''
	;['info', 'warn', 'error'].forEach((type) => {
		logger[type] = function () {
			if (
				config.verbosity.levels[type] <
				config.verbosity.levels[config.opts.verbosity]
			) {
				return
			}

			const ts = new Date().toJSON().replace('T', ' ').substring(0, 19)
			const log = console[type]

			log(`[grpc${part}] [${type}] ${ts}:`, ...arguments)
		}
	})

	return logger
}
