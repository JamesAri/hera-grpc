module.exports = {
	timeouts: {
		// default deadline we set on calls, user can override it if
		// it is not part of a nested call (i.e. a call from a service handler)
		callDeadline: 60, // in seconds
		// https://grpc.io/docs/guides/server-graceful-stop/
		// we will give 2 seconds for the server to finish processing
		// the requests before we force shutdown
		forceServerShutdown: 2000, // in ms
	},
	retry: {
		// retry strategy for getting a service from zk
		getService: {
			delay: 1000, // in ms
			maxAttempts: 10, // results in 10s total delay
		},
	},
	zk: {
		connection: process.env.ZK,
	},
	compression: {
		algorithms: {
			noCompression: 0,
			deflateAlgorithm: 1,
			gzipAlgorithm: 2,
			streamGzip: 3, // Stream compression with GZIP algorithm
		},
		levels: {
			none: 0,
			low: 1,
			medium: 2,
			high: 3,
		},
	},
}
