const fs = require('fs')
const path = require('path')

const ZooKeeper = require('../../lib/zookeeper')
const debug = require('debug')('main')

const {getProtoJsonDescriptorBuffer} = require('../../lib/utils')

const config = {
	zookeeper: 'zk://localhost:2181/hera-test',
}

const zk = new ZooKeeper({config})

const TEST_SERVICE_ROUTE_1 = '/slechtaj-1.0.0/dev~service_route/test/chat'
const TEST_SERVICE_ROUTE_2 = '/slechtaj-1.0.0/dev~service_route/test/messagetype'

const TEST_FILES_1 = [
	path.join(__dirname, 'chat.proto'),
	// we don't need to include all paths manually, protobufjs will resolve them
	// path.join(__dirname, 'nested/message-type.proto'),
]

const TEST_FILES_2 = [
	path.join(__dirname, 'nested/message-type.proto'),
]

zk.connect()

zk.on('connected', async () => {
	debug('Connected to ZooKeeper')

	// SERVER SIDE

	const protoFileBuffer1 = getProtoJsonDescriptorBuffer(TEST_FILES_1)
	const protoFileBuffer2 = getProtoJsonDescriptorBuffer(TEST_FILES_2)

	const protoFiles = [
		{
			serviceName: 'Chat',
			route: TEST_SERVICE_ROUTE_1,
			buffer: protoFileBuffer1,
			loadOptions: {
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
		},
		{
			serviceName: 'NoServiceActually',
			route: TEST_SERVICE_ROUTE_2,
			buffer: protoFileBuffer2,
			loadOptions: {
				keepCase: true,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
			},
		}
	]

	const serviceInfo = {
		host: 'localhost',
		port: 50052,
	}

	zk.register(serviceInfo, protoFiles, (err, res) => {
		if (err) {
			console.error(err)
			return
		}
		debug('Service registered:', res)
		zk.ready()
	})

	// CLIENT SIDE

	zk.on('ready', async () => {
		zk.watchServices()
	})

	zk.on('services', async (allServices) => {
		debug('All available services:')
		debug(allServices)

		const services = allServices[TEST_SERVICE_ROUTE_1]

		if (!services) {
			console.error(`There are no services for "${TEST_SERVICE_ROUTE_1}"`)
			return
		}
		debug(`Available services for ${TEST_SERVICE_ROUTE_1}:`)
		debug(services)

		// get random service
		const rndService = services[Math.floor(Math.random() * services.length)]

		debug(`Random service.proto[${TEST_SERVICE_ROUTE_1}]:`)
		const proto = rndService.routes[TEST_SERVICE_ROUTE_1]
		debug(proto)

		const buffer = await zk.getData(proto.znode)

		zk.disconnect()
		debug('Disconnected from ZooKeeper')

		if (!buffer) {
			console.error('Proto buffer not found')
			return
		}
		fs.writeFileSync(path.join(__dirname, 'out.json'), buffer)
	})
})

