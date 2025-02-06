const debug = require('debug')('callee')

const ServiceClient = require('../../lib/service-client')
const config = require('./config')
const zookeeper = require('./di').zookeeper

// Mock some service that we want to register
const chatLoadConfig = require('../proto-repo/chat/config')
const { chatServiceHandlers } = require('../grpc/server/service-handlers')

const serviceInfo = {
	serviceName: chatLoadConfig.serviceName,
	version: '1.0.0',
	route: '/slechtaj-1.0.0/dev~service_route/test',
	loadConfig: chatLoadConfig.loadOptions,
}

const protoFiles = [chatLoadConfig.protoPath]

function callee() {
	const sc = new ServiceClient({ config, zookeeper })

	try {
		sc.on('connected', () => {
			debug('Connected to the service router')
			sc.registerService(serviceInfo, protoFiles, chatServiceHandlers)
			sc.listen()
		})

		sc.on('error', (err) => {
			process.exitCode = 1
			console.error(err.message)

			sc.close() // should be done automatically?
		})

		sc.on('close', () => {
			process.exit()
		})

		sc.connect()
	} catch (error) {
		console.error(`Unexpected error: ${error.message}`)
	}
}

if (require.main === module) {
	callee()
}
