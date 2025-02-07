// mock repos
const GRPCServer = require('../../../lib/grpc-server')

const {
	poiServiceHandlers,
	chatServiceHandlers,
	fileShareServiceHandlers,
} = require('./service-handlers')

const {
	poiService,
	chatService,
	fileShareService,
} = require('../../proto-repo')

const server = new GRPCServer()

server.registerService(chatService.ServiceStub, chatServiceHandlers)
server.registerService(poiService.ServiceStub, poiServiceHandlers)
server.registerService(fileShareService.ServiceStub, fileShareServiceHandlers)

server.listen('0.0.0.0', 50051)
