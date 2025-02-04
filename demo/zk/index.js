const fs = require('fs')
const path = require('path')

const ZooKeeper = require('../../lib/zookeeper')
const debug = require('debug')('main')

const config = {
	zookeeper: 'zk://localhost:2181/hera-test',
}

const zk = new ZooKeeper({ config })

zk.connect()

const TEST_SERVICE_ROUTE = '/slechtaj-1.0.0/dev~service_route/test'

zk.on('connected', async () => {
	debug('Connected to ZooKeeper')

	// SERVER SIDE

	const protoFileBuffer = fs.readFileSync(path.join(__dirname, 'index.js'))

	const serviceInfo = {
		appName: 'TestAppName',
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

	const protoFiles = [
		{
			name: 'test-service.proto',
			buffer: protoFileBuffer,
			main: true,
		},
		{
			name: 'test-service.js',
			buffer: protoFileBuffer,
		}
	]

	zk.register(serviceInfo, protoFiles, (err, res) => {
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

		const protoFiles = []
		for (const protoFile of rndService.proto) {
			const buffer = await zk.getProtoFile(protoFile.znode)
			protoFiles.push({
				name: protoFile.name,
				buffer: buffer,
				main: protoFile.main,
			})
		}

		zk.disconnect()
		debug('Disconnected from ZooKeeper')

		if (!protoFiles) {
			console.error('Proto files not found')
			return
		}
		for (const protoFile of protoFiles) {
			fs.writeFileSync(path.join(__dirname, protoFile.name), protoFile.buffer)
		}
	})
})

