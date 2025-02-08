const debug = require('debug')('callee')

const ServiceClient = require('../../lib/service-client')
const config = require('./config')
const zookeeper = require('./di').zookeeper

// Mock some services that we want to register
const chatLoadConfig = require('../proto/chat/config')
const poiLoadConfig = require('../proto/poi/config')
const fileShareLoadConfig = require('../proto/file-share/config')

// service with long-lived bidi-stream
const chatService = {
	route: '/slechtaj-1.0.0/dev~service_route/chat',
	handlers: require('./chat/handlers'),
	serviceName: chatLoadConfig.serviceName,
	filename: chatLoadConfig.filename,
	loadOptions: chatLoadConfig.loadOptions,
}

// service with all types of grpc streams/requests
const poiService = {
	route: '/slechtaj-1.0.0/dev~service_route/poi',
	handlers: require('./poi/handlers'),
	serviceName: poiLoadConfig.serviceName,
	filename: poiLoadConfig.filename,
	loadOptions: poiLoadConfig.loadOptions,
}

// service with request-stream file upload demo
const fileShareService = {
	route: '/slechtaj-1.0.0/dev~service_route/file_share',
	handlers: require('./file-share/handlers'),
	serviceName: fileShareLoadConfig.serviceName,
	filename: fileShareLoadConfig.filename,
	loadOptions: fileShareLoadConfig.loadOptions,
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
		sc.once('zkReady', () => {
			debug('Zookeeper ready')
			// zk ready => register services to grpc server & zk => start grpc server
			registerServices([chatService, poiService, fileShareService], sc)
			sc.listen()
		})

		sc.once('registered', () => {
			debug('Services registered to zookeeper')
			// our services registered (in zk and grpc server) and grpc
			// server is listening => we are ready to handle requests
			sc.connect()
		})

		sc.once('connected', () => {
			debug('Connected to the service network')
			// we are connected to the service network and ready to handle/send requests
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
