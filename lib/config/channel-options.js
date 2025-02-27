const { COMPRESSION_LEVELS, COMPRESSION_ALGORITHMS } = require('../constants')

module.exports = {
	'grpc.enable_channelz': true,
	'grpc.default_compression_level': COMPRESSION_LEVELS.MEDIUM,
	'grpc.default_compression_algorithm': COMPRESSION_ALGORITHMS.STREAM_GZIP,
}
