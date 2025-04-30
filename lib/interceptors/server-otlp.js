const grpc = require('@grpc/grpc-js')
const { metrics } = require('@opentelemetry/api')
const debug = require('debug')('server-interceptor:otlp')

const { Logger } = require('../../experimental/logger')

const NAMESPACE = `server-otlp-interceptor`
const logger = new Logger(NAMESPACE)
const meter = metrics.getMeter(NAMESPACE, '0.0.1')

const rpcServerDuration = meter.createHistogram('rpc_server_duration_milliseconds', {
	description: 'Measures the duration of inbound RPC.',
	unit: 'ms',
})

/**
 * Interceptor for OpenTelemetry tracing, logs, metrics, etc.
 */
module.exports = class ServerOTLPInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
		this.sendStatus = this.sendStatus.bind(this)
		this.start = this.start.bind(this)

		this.timestamp = {}
	}

	start(next) {
		this.timestamp.start = new Date()
		return next(this.listener)
	}

	sendStatus(status, next) {
		const { code, details } = status

		if (code !== grpc.status.OK) {
			logger.error(`RPC failed with code: ${code} and details: ${details}`)
		}

		const path = this.methodDescriptor?.path

		const elapsed = new Date() - this.timestamp.start

		debug(`RPC ${path} | code: ${code} | details: ${details} | ${elapsed}ms`)

		rpcServerDuration.record(elapsed, {
			'grpc.path': path,
			'grpc.code': code,
			'grpc.details': details,
		})

		next(status)
	}

	/**
	 * grpc.ServerInterceptor
	 * @param {grpc.ServerMethodDefinition<any, any>} methodDescriptor
	 * @param {grpc.ServerInterceptingCallInterface} nextCall
	 * @returns {grpc.ServerInterceptingCall}
	 */
	interceptor(methodDescriptor, nextCall) {
		debug(methodDescriptor.path)

		this.methodDescriptor = methodDescriptor
		this.nextCall = nextCall

		// prettier-ignore
		this.listener = (new grpc.ServerListenerBuilder())
			.build()

		// prettier-ignore
		this.responder = (new grpc.ResponderBuilder())
			.withStart(this.start)
			.withSendStatus(this.sendStatus)
			.build()

		return new grpc.ServerInterceptingCall(this.nextCall, this.responder)
	}
}
