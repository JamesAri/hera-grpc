const compression = require('../const/compression')

module.exports = {
	// https://github.com/grpc/grpc-node/blob/master/doc/compression.md
	'grpc.default_compression_level': compression.LEVELS.MEDIUM,
	'grpc.default_compression_algorithm': compression.ALGORITHMS.GZIP,
}
