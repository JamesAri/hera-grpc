if (process.env.EXPERIMENTAL_OTEL) {
	require('./experimental/instrumentation')
}

// TODO: make @grpc-js a peer dependency?
const grpc = require('@grpc/grpc-js')

const ServiceClient = require('./lib/client')
const compression = require('./lib/const/compression')
const logLevels = require('./lib/const/log-levels')
const rpcWhitelist = require('./lib/const/rpc-no-auth')
const internal = require('./lib/proto/internal-services')

module.exports = {
	ServiceClient,
	internal,
	grpc,
	compression,
	logLevels,
	rpcWhitelist,
}
