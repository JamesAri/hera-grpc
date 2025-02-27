const { COMPRESSION_ALGORITHMS, COMPRESSION_LEVELS } = require('./constants')

// TODO: let user/server override some of these values
module.exports = {
	timeouts: {
		// default deadline we set on calls, user can override it if
		// it is not part of a nested call (i.e. a call from a service handler)
		callDeadline: 30, // in seconds
		// we will give 5 seconds for the server to finish processing
		// the requests before we force shutdown
		forceServerShutdown: 5000, // in ms
	},
	retry: {
		// retry strategy for getting a service from zk
		getService: {
			delay: 1000, // in ms
			maxAttempts: 10,
		},
	},
	// Default channel options - see https://github.com/grpc/grpc-node/tree/master/packages/grpc-js#supported-channel-options
	channelOptions: {
		enableChannelz: true,
		defaultCompressionAlgorithm: COMPRESSION_ALGORITHMS.STREAM_GZIP,
		defaultCompressionLevel: COMPRESSION_LEVELS.MEDIUM,
	},
	// Default metadata options - see https://grpc.github.io/grpc/node/grpc.Metadata.html
	metadataOptions: {
		waitForReady: true,
	},
}
