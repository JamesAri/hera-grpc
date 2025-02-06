const fs = require('fs')
const path = require('path')

const ZooKeeper = require('../../lib/zookeeper')
const debug = require('debug')('main')

const {getProtoJsonDescriptorBuffer} = require('../../lib/utils')

const config = {
	zookeeper: 'zk://localhost:2181/hera-test',
}

const zk = new ZooKeeper({config})

const TEST_SERVICE_ROUTE = '/slechtaj-1.0.0/dev~service_route/test'

const TEST_FILES = [
	path.join(__dirname, 'chat.proto'),
	// we don't need to include all paths manually, protobufjs will resolve them
	// path.join(__dirname, 'nested/messagetype.proto'),
]

zk.connect()

zk.on('connected', async () => {
	debug('Connected to ZooKeeper')

	// SERVER SIDE

	const protoFileBuffer = getProtoJsonDescriptorBuffer(TEST_FILES)

	const serviceInfo = {
		serviceName: 'TestService',
		version: '1.0.0',
		host: 'localhost',
		port: 50052,
		route: TEST_SERVICE_ROUTE,
		loadOptions: {
			keepCase: true,
			longs: String,
			enums: String,
			defaults: true,
			oneofs: true,
		},
	}

	zk.register(serviceInfo, protoFileBuffer, (err, res) => {
		if (err) {
			console.error(err)
			return
		}
		debug('Service registered:', res)
	})

	// CLIENT SIDE

	zk.on('ready', async () => {
		zk.watchServices()
	})

	zk.on('services', async (allServices) => {
		debug('All available services:')
		debug(allServices)

		const services = allServices[TEST_SERVICE_ROUTE]

		if (!services) {
			console.error(`There are no services for "${TEST_SERVICE_ROUTE}"`)
			return
		}
		debug(`Available services for ${TEST_SERVICE_ROUTE}:`)
		debug(services)

		// get random service
		const rndService = services[0]

		debug('Random service loadOptions:')
		debug(rndService.loadOptions)

		debug('Random service proto:')
		debug(rndService.proto)

		const buffer = await zk.getProtoFile(rndService.proto)

		zk.disconnect()
		debug('Disconnected from ZooKeeper')

		if (!buffer) {
			console.error('Proto buffer not found')
			return
		}
		fs.writeFileSync(path.join(__dirname, 'out.json'), buffer)
	})
})

