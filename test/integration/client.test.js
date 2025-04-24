require('dotenv').config()

const assert = require('assert')
const { promisify } = require('util')

const { ServiceClient } = require('../..')
const protoTestConfig = require('../fixtures/proto-test-config')

const GRPC_PORT = process.env.HERA_PORT || 50051

describe('Core ServiceClient integration tests', () => {
	let client = /** @type {import('../..').ServiceClient} */ (null)

	beforeEach(() => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})
	})

	it('can connect', async () => {
		await client.connect()
		await client.close()
	})

	it('registration of simple service with request-response rpc', async () => {
		const serverResponseMessage = 'Test RPC response message'
		const clientRequestMessage = 'Test RPC request message'
		const service = {
			routes: 'GET 1234/test/route',
			serviceName: protoTestConfig.serviceName,
			filename: protoTestConfig.filename,
			loadOptions: protoTestConfig.loadOptions,
			handlers: {
				testRpc: (call, callback) => {
					assert.strictEqual(
						call.request.message,
						clientRequestMessage,
						'Received incorrect request message',
					)
					callback(null, { message: serverResponseMessage })
				},
			},
		}

		client.registerService(service)

		client.on('registered', (boundPort) => {
			assert.strictEqual(boundPort, GRPC_PORT)
		})

		await client.connect()
		const stub = await client.getStub(service.routes)
		stub.testRpc = promisify(stub.testRpc).bind(stub)

		const response = await stub.testRpc({ message: clientRequestMessage })
		assert.strictEqual(
			response.message,
			serverResponseMessage,
			'Received incorrect response message',
		)
		stub.close() // this closes the underlying grpc channel
		await client.close() // this closes the service client managing the grpc infrastructure
	})
})
