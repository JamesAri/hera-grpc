/* eslint-disable no-console */
const { SeverityNumber } = require('@opentelemetry/api-logs')
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-proto')
const { Resource } = require('@opentelemetry/resources')
const { LoggerProvider, BatchLogRecordProcessor } = require('@opentelemetry/sdk-logs')
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions')

const logLevels = require('../lib/const/log-levels')

class Logger {
	static level = logLevels.INFO
	context

	constructor(context) {
		this.context = context

		// To start a logger, you first need to initialize the Logger provider.
		const loggerProvider = new LoggerProvider({
			resource: new Resource({
				[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME,
				[ATTR_SERVICE_VERSION]: process.env.OTEL_SERVICE_VERSION,
			}),
		})
		// Add a processor to export log record
		loggerProvider.addLogRecordProcessor(new BatchLogRecordProcessor(new OTLPLogExporter()))

		this.logger = loggerProvider.getLogger('default')
	}

	static setLevel(level) {
		const logLevel = Object.entries(logLevels).find(([_, l]) => l === level)
		if (logLevel?.length) {
			console.log(`Setting log level to "${logLevel[0]}"`)
			Logger.level = logLevel[1]
		} else {
			throw new Error(`Invalid log level: ${level}`)
		}
	}

	formatMessage(message) {
		return `[${new Date().toISOString()}] [${this.context}] - ${message}`
	}

	debug(message) {
		this.logger.emit({
			severityNumber: SeverityNumber.DEBUG,
			severityText: 'DEBUG',
			body: message,
			attributes: {
				context: this.context,
			},
		})

		if (Logger.level <= logLevels.DEBUG) {
			console.debug(this.formatMessage(message))
		}
	}

	info(message) {
		this.logger.emit({
			severityNumber: SeverityNumber.INFO,
			severityText: 'INFO',
			body: message,
			attributes: {
				context: this.context,
			},
		})

		if (Logger.level <= logLevels.INFO) {
			console.info(this.formatMessage(message))
		}
	}

	warn(message) {
		this.logger.emit({
			severityNumber: SeverityNumber.WARN,
			severityText: 'WARN',
			body: message,
			attributes: {
				context: this.context,
			},
		})

		if (Logger.level <= logLevels.WARN) {
			console.warn(this.formatMessage(message))
		}
	}

	error(message) {
		this.logger.emit({
			severityNumber: SeverityNumber.ERROR,
			severityText: 'ERROR',
			body: message,
			attributes: {
				context: this.context,
			},
		})

		if (Logger.level <= logLevels.ERROR) {
			console.error(this.formatMessage(message))
		}
	}
}

module.exports = { Logger }
