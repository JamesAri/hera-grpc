const ServiceClient = require('../../../lib/service-client')
const config = require('../config')
const zookeeper = require('../di').zookeeper
const debug = require('debug')('caller')

const Chat = require('../../grpc/client/chat/chat')

function caller() {
	const sc = new ServiceClient({config, zookeeper})

	try {
		sc.once('zkReady', () => {
			debug('Zookeeper ready')

			sc.connect()
		})

		sc.once('connected', async () => {
			debug('Connected to the service network')

			// TODO: handle if sc.callService called multiple times without await
			await sc.callService('/slechtaj-1.0.0/dev~service_route/chat', (service) => {
				const chat = new Chat({ service })
				chat.start()
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
