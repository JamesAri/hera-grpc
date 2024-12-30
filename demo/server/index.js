// mock repos
const GRPCServer = require('../../lib/server')

const poiServiceHandlers = require('./service-handlers/poi-service-handlers')
const {poiServiceLoader} = require('../../proto-repo')

const chatServiceHandlers = require('./service-handlers/chat-service-handlers')
const {chatServiceLoader} = require('../../proto-repo')

const server = new GRPCServer()

server.registerService(chatServiceLoader, chatServiceHandlers)
server.registerService(poiServiceLoader, poiServiceHandlers)

server.listen('0.0.0.0', 50051)
