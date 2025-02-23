module.exports = {
	// https://github.com/grpc/grpc-node/blob/master/doc/compression.md
	COMPRESSION_ALGORITHMS: {
		NO_COMPRESSION: 0,
		DEFLATE_ALGORITHM: 1,
		GZIP_ALGORITHM: 2,
		STREAM_GZIP: 3,
	},
	COMPRESSION_LEVELS: {
		NONE: 0,
		LOW: 1,
		MEDIUM: 2,
		HIGH: 3,
	},
}
