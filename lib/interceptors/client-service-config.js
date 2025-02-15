const grpc = require('@grpc/grpc-js')
const debug = require('debug')('client-metadata-interceptor')

// TODO: We can create custom loadbalancer with respect to load:
// https://grpc.io/docs/guides/custom-backend-metrics/

// Service Config IDL:
// https://github.com/grpc/grpc-proto/blob/master/grpc/service_config/service_config.proto

const SERVICE_CONFIG = JSON.stringify({
	loadBalancingConfig: [{ round_robin: {} }],
	methodConfig: [
		{
			// empty => all services
			name: [],
			// note: do not set timeout since we have a separate interceptor for that
			// timeout: '1.000000001s',
		},
	],
})

module.exports = class ClientServiceConfigInterceptor {
	constructor() {
		this.interceptor = this.interceptor.bind(this)
	}

	addServiceConfig() {
		if (!this.options['grpc.service_config']) {
			debug(`Adding service config: ${SERVICE_CONFIG}`)
			this.options['grpc.service_config'] = SERVICE_CONFIG
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

		this.addServiceConfig()
		return new grpc.InterceptingCall(nextCall(this.options))
	}
}
