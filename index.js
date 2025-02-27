if (process.env.EXPERIMENTAL_OTEL) {
	require('./experimental/tracing')
}

// TODO: make @grpc-js a peer dependency?
const grpc = require('@grpc/grpc-js')

const ServiceClient = require('./lib/client')
const { compression } = require('./lib/constants')
const INTERNAL_SERVICES = require('./lib/proto/internal-services')

module.exports = {
	ServiceClient,
	grpc,
	compression,
	internal: INTERNAL_SERVICES,
}
