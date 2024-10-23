// Main driver for the gRPC Server

const { getServiceStubConstructor } = require('../../lib/utils')
const serviceHandlers = require('./services/demo-service/service-handlers')
const serviceConfig = require('../demo-shared/services/demo-service/service-config')
const GRPCServer = require('../../lib/server')

const ServiceStubConstructor = getServiceStubConstructor(serviceConfig)

const server = new GRPCServer(ServiceStubConstructor, serviceHandlers)

server.listen('0.0.0.0', 50051)
