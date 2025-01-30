const path = require('path')

const ServiceClient = require('../../lib/service-client')
const GRPCServer = require('../../lib/grpc-server')

// Mock some service that we want to register
const { chatServiceLoader } = require('../../proto-repo')
const { chatServiceHandlers } = require('../grpc/server/service-handlers')

function callee() {
	// Mock a registered service
	const server = new GRPCServer()
	const chatServiceProtoFile = path.join(__dirname, '/../../proto-repo/chat/chat.proto')

	server.registerService(chatServiceLoader, chatServiceHandlers)
	server.listen('0.0.0.0', 50052)

	// Use service client from lib to connect to the service router
	const sc = new ServiceClient({
		host: '0.0.0.0',
		port: 50052,
	})

	try {
		sc.createSession()

		sc.on('connected', () => {
			sc.registerService(chatServiceProtoFile, '/service_test')
			console.log('main_callee - Connected to the service router')
		})

		sc.on('error', (err) => {
			process.exitCode = 1
			console.error(err.message)
		})

		sc.on('close', () => {
			sc.cleanup()
			process.exit()
		})
	} catch (error) {
		console.error(`Unexpected error: ${error.message}`)
	}
}

if (require.main === module) {
	callee()
}
