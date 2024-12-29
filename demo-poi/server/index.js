const serviceHandlers = require('./service-handlers')
const {poiServiceLoader} = require('../../proto-repo')

// mock repository
const GRPCServer = require('../../lib/server')

const server = new GRPCServer(poiServiceLoader, serviceHandlers)

server.listen('0.0.0.0', 50051)
