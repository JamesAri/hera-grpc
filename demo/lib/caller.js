const ServiceClient = require('../../lib/service-client')
const config = require('./config')
const zookeeper = require('./di').zookeeper
const debug = require('debug')('caller')

const Chat = require('../grpc/client/chat/chat')

function caller() {
	const sc = new ServiceClient({config, zookeeper})

	try {
		sc.on('connected', () => {
			debug('Connected to the service router')

			sc.callService('/slechtaj-1.0.0/dev~service_route/test', (service) => {
				const chat = new Chat({ service })
				chat.start()
			})
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
	caller()
}
