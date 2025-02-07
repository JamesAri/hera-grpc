const ServiceClient = require('../../lib/service-client')
const config = require('./config')
const zookeeper = require('./di').zookeeper
const debug = require('debug')('caller')

const Chat = require('../grpc/client/chat/chat')

function caller() {
	const sc = new ServiceClient({config, zookeeper})

	try {
		sc.on('zkReady', () => {
			debug('Zookeeper ready')

			sc.connect()
		})

		sc.on('connected', () => {
			debug('Connected to the service network')

			sc.callService('/slechtaj-1.0.0/dev~service_route/chat', (service) => {
				const chat = new Chat({ service })
				chat.start()
			})
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
		console.error(`Unexpected error: ${error.message}`)
	}
}


if (require.main === module) {
	caller()
}
