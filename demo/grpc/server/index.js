// mock repos
const GRPCServer = require('../../../lib/grpc-server')

const {
	poiServiceHandlers,
	chatServiceHandlers,
	fileShareServiceHandlers,
} = require('./service-handlers')

const {
	poiServiceLoader,
	chatServiceLoader,
	fileShareServiceLoader,
} = require('../../proto-repo')

const server = new GRPCServer()

server.registerService(chatServiceLoader, chatServiceHandlers)
server.registerService(poiServiceLoader, poiServiceHandlers)
server.registerService(fileShareServiceLoader, fileShareServiceHandlers)

server.listen('0.0.0.0', 50051)
