const serviceHandlers = require('./service-handlers')

// mock repos
const GRPCServer = require('../../lib/server')
const {chatServiceLoader} = require('../../proto-repo')

const server = new GRPCServer(chatServiceLoader, serviceHandlers)

server.listen('0.0.0.0', 50051)
