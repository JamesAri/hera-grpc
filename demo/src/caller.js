const ServiceClient = require('@slechtaj/service-client')
const config = require('./config')
const zookeeper = require('./di').zookeeper
const debug = require('debug')('caller')

const path = require('path')

// Implementation of the rpc for the service we want to call
const ChatClient = require('./chat/client')
const poiClient = require('./poi/client')
const FileShareClient = require('./file-share/client')
const jsonClient = require('./json/client')

function caller() {
	const sc = new ServiceClient({config, zookeeper})

	try {
		sc.once('zkReady', () => {
			debug('Zookeeper ready')

			sc.connect()
		})

		sc.once('connected', async () => {
			debug('Connected to the service network')

			false && await sc.callService('/slechtaj-1.0.0/dev~service_route/file_share', (client) => {
				const fsc = new FileShareClient(client)
				fsc.sendFile(path.join(__dirname, 'caller.js')) // share come rnd file
			})

			false && await sc.callService('/slechtaj-1.0.0/dev~service_route/poi', async (client) => {
				await poiClient(client) // run all types of rpcs
			})

			false && await sc.callService('/slechtaj-1.0.0/dev~service_route/chat', (client) => {
				const chat = new ChatClient(client) // run long-lived bidi-stream rpc
				chat.start()
			})

			await sc.callService('/slechtaj-1.0.0/dev~broker', async (client) => {
				const res = await jsonClient(client)
				console.log('Received response:', res)
			})

			await sc.callService('/slechtaj-1.0.0/dev~broker', async (client) => {
				const res = await jsonClient(client)
				console.log('Received response:', res)
			})

			// sc.close()
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
