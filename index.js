if (process.env.EXPERIMENTAL_OTEL) {
	require('./experimental/tracing')
}

// TODO: make @grpc-js a peer dependency?
const grpc = require('@grpc/grpc-js')

const ServiceClient = require('./lib/client')
const { COMPRESSION_ALGORITHMS, COMPRESSION_LEVELS } = require('./lib/constants')

module.exports = {
	ServiceClient,
	grpc,
	compression: {
		COMPRESSION_ALGORITHMS,
		COMPRESSION_LEVELS,
	},
}
