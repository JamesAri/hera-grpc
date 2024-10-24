// Main driver for the gRPC Server

const { getServiceStubConstructor } = require('../../lib/utils')
const chatServiceHandlers = require('./services/chat-service/service-handlers')
const chatServiceConfig = require('../shared/services/chat-service/service-config')
const GRPCServer = require('../../lib/server')

const ChatServiceStubConstructor = getServiceStubConstructor(chatServiceConfig)

const server = new GRPCServer(ChatServiceStubConstructor, chatServiceHandlers)

server.listen('0.0.0.0', 50051)
