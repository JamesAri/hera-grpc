const debug = require('debug')('callee')

const ServiceClient = require('../../lib/service-client')
const config = require('./config')
const zookeeper = require('./di').zookeeper

// Mock some service that we want to register
const chatLoadConfig = require('../proto-repo/chat/config')
const { chatServiceHandlers } = require('../grpc/server/service-handlers')

const chatService = {
	route: '/slechtaj-1.0.0/dev~service_route/chat',
	serviceName: chatLoadConfig.serviceName,
	filename: chatLoadConfig.filename,
	loadConfig: chatLoadConfig.loadOptions,
	handlers: chatServiceHandlers,
}

function callee() {
	const sc = new ServiceClient({ config, zookeeper })

	try {
		sc.registerService(
			chatService.route,
			chatService.filename,
			chatService.serviceName,
			chatService.handlers,
			chatService.loadConfig,
		)

		sc.on('zkReady', () => {
			debug('Zookeeper ready')
			// zk ready => we can start our grpc server => register services to zk
			sc.listen()
		})

		sc.on('registered', () => {
			// our services registered => we are ready to handle requests
			debug('Services registered to zookeeper')
			sc.connect()
		})

		sc.on('connected', () => {
			debug('Connected to the service network')
		})

		sc.on('error', (error) => {
			process.exitCode = 1
			console.error(error)
		})

		sc.on('close', () => {
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
