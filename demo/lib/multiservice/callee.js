const debug = require('debug')('callee')

const ServiceClient = require('../../../lib/service-client')
const config = require('../config')
const zookeeper = require('../di').zookeeper

// Mock some service that we want to register
const chatLoadConfig = require('../../proto-repo/chat/config')
const poiLoadConfig = require('../../proto-repo/poi/config')
const { chatServiceHandlers, poiServiceHandlers } = require('../../grpc/server/service-handlers')

const chatService = {
	route: '/slechtaj-1.0.0/dev~service_route/chat',
	serviceName: chatLoadConfig.serviceName,
	filename: chatLoadConfig.filename,
	loadOptions: chatLoadConfig.loadOptions,
	handlers: chatServiceHandlers,
}

const poiService = {
	route: '/slechtaj-1.0.0/dev~service_route/poi',
	serviceName: poiLoadConfig.serviceName,
	filename: poiLoadConfig.filename,
	loadOptions: poiLoadConfig.loadOptions,
	handlers: poiServiceHandlers,
}

const registerServices = (services, sc) => {
	for (const service of services) {
		sc.registerService(
			service.route,
			service.filename,
			service.serviceName,
			service.handlers,
			service.loadOptions,
		)
	}
}

function callee() {
	const sc = new ServiceClient({ config, zookeeper })

	try {
		registerServices([chatService, poiService], sc)

		sc.once('zkReady', () => {
			debug('Zookeeper ready')
			// zk ready => we can start our grpc server => register services to zk
			sc.listen()
		})

		sc.once('registered', () => {
			// our services registered => we are ready to handle requests
			debug('Services registered to zookeeper')
			sc.connect()
		})

		sc.once('connected', () => {
			debug('Connected to the service network')
		})

		sc.once('error', (error) => {
			process.exitCode = 1
			console.error(error)
		})

		sc.once('close', () => {
			process.exit()
		})

		sc.connectToZookeeper()
	} catch (error) {
		console.error('Unexpected error:')
		console.error(error)
	}
}

if (require.main === module) {
	callee()
}
