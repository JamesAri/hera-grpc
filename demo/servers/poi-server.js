// Main driver for the gRPC Server

const { getServiceStubConstructor } = require('../../lib/utils')
const serviceHandlers = require('./services/poi-service/service-handlers')
const serviceConfig = require('../shared/services/poi-service/service-config')
const GRPCServer = require('../../lib/server')

const PoiServiceStubConstructor = getServiceStubConstructor(serviceConfig)

const server = new GRPCServer(PoiServiceStubConstructor, serviceHandlers)

server.listen('0.0.0.0', 50051)
