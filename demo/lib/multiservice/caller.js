const ServiceClient = require('../../../lib/service-client')
const config = require('../config')
const zookeeper = require('../di').zookeeper
const debug = require('debug')('caller')

const poiRun = require('../../grpc/client/poi/poi')

function caller() {
	const sc = new ServiceClient({config, zookeeper})

	try {
		sc.once('zkReady', () => {
			debug('Zookeeper ready')

			sc.connect()
		})

		sc.once('connected', async () => {
			debug('Connected to the service network')

			await sc.callService('/slechtaj-1.0.0/dev~service_route/poi', (service) => {
				poiRun(service)
			})
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
		console.error(`Unexpected error: ${error.message}`)
	}
}


if (require.main === module) {
	caller()
}
