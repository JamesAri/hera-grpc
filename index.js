if (process.env.EXPERIMENTAL_OTEL) {
	require('./experimental/tracing')
}

const ServiceClient = require('./lib/client')

module.exports = ServiceClient

module.exports.grpc = require('@grpc/grpc-js')
