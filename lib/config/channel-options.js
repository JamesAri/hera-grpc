const { compression } = require('../constants')

module.exports = {
	'grpc.enable_channelz': true,
	// https://github.com/grpc/grpc-node/blob/master/doc/compression.md
	'grpc.default_compression_level': compression.LEVELS.MEDIUM,
	'grpc.default_compression_algorithm': compression.ALGORITHMS.GZIP,
}
