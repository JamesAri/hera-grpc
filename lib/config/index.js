module.exports = {
	timeouts: {
		// default deadline we set on calls, user can override it if
		// it is not part of a nested call (i.e. a call from a service handler)
		callDeadline: 30, // in seconds
		// we will give 5 seconds for the server to finish processing
		// the requests gracefully before we force shutdown
		forceServerShutdown: 5000, // in ms
	},
	// retry strategy for getting a service from zookeeper
	retry: {
		getService: {
			delay: 1000, // in ms
			maxAttempts: 10,
		},
	},
	// Default metadata options - see https://grpc.github.io/grpc/node/grpc.Metadata.html
	metadataOptions: {
		waitForReady: true,
	},
	// Default channel options - see https://github.com/grpc/grpc-node/tree/master/packages/grpc-js#supported-channel-options
	channelOptions: require('./channel-options'),
	// Default service config - see https://grpc.io/docs/guides/service-config/
	serviceConfig: require('./service-config'),
}
