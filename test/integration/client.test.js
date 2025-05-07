require('dotenv').config()
const assert = require('assert')
const { promisify } = require('util')

const grpc = require('@grpc/grpc-js')
const sinon = require('sinon')

const { ServiceClient } = require('../..')
const protoTestConfig = require('../fixtures/proto-test-config')

const GRPC_PORT = process.env.HERA_PORT || 50051
const GRPC_PORT2 = process.env.HERA_PORT2 || 50052

const SERVER_RESPONSE_MESSAGE = 'Test RPC response message'
const CLIENT_REQUEST_MESSAGE = 'Test RPC request message'

const getTestService = (options = {}) => {
	const { routes, serviceName, filename, loadOptions, handlers, rpcResponse } = options

	const message = rpcResponse || { message: SERVER_RESPONSE_MESSAGE }

	return {
		routes: routes || 'GET 1234/test/route',
		serviceName: serviceName || protoTestConfig.serviceName,
		filename: filename || protoTestConfig.filename,
		loadOptions: loadOptions || protoTestConfig.loadOptions,
		handlers: handlers || {
			testRpc: (_call, callback) => {
				callback(null, message)
			},
		},
	}
}

const getTestInternalService = (options = {}) => {
	const { routes, serviceName, handlers } = options
	return {
		routes: routes || 'GET 1234/test/hera/internal/json/service',
		serviceName: serviceName || 'hera.internal.v1.JsonService',
		handlers: handlers || {
			jsonRpc: (_call, callback) => {
				callback(null, { data: Buffer.from(SERVER_RESPONSE_MESSAGE) })
			},
		},
	}
}

describe('Core ServiceClient integration tests', () => {
	let client = /** @type {import('../..').ServiceClient} */ (null)
	let stub = /** @type {grpc.Client} */ (null)

	afterEach(async () => {
		// closes the underlying grpc channel
		stub?.close()
		stub = null
		// closes the service client managing the distributed system
		await client?.close()
		client = null
	})

	it('can connect without registering', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		await client.connect()
	})

	it('registration of simple service with request-response rpc', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		const testService = getTestService({
			handlers: {
				testRpc: (call, callback) => {
					assert.strictEqual(
						call.request.message,
						CLIENT_REQUEST_MESSAGE,
						'Received incorrect request message',
					)
					callback(null, { message: SERVER_RESPONSE_MESSAGE })
				},
			},
		})
		client.registerService(testService)

		await client.connect()

		stub = await client.getStub(testService.routes)
		stub.testRpc = promisify(stub.testRpc).bind(stub)

		const response = await stub.testRpc({ message: CLIENT_REQUEST_MESSAGE })

		assert.strictEqual(
			response.message,
			SERVER_RESPONSE_MESSAGE,
			'Received incorrect response message',
		)
	})

	it('server and client load options propagation - keepCase field', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		const rpcResponse = { message: SERVER_RESPONSE_MESSAGE, test_key: 'test_key has underscore' }

		const testService = getTestService({ rpcResponse })
		client.registerService(testService)

		await client.connect()

		stub = await client.getStub(testService.routes)
		stub.testRpc = promisify(stub.testRpc).bind(stub)

		const response = await stub.testRpc({ message: 'not important' })

		assert.strictEqual(response.message, rpcResponse.message, `Received incorrect response message`)
		assert.strictEqual(
			response.test_key,
			rpcResponse.test_key,
			`Received incorrect response message - doesn't respect the keepCase option for the response`,
		)
	})

	it('listens on user provided port', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		client.registerService(getTestService())

		const onRegisteredSpy = sinon.spy()
		client.on('registered', onRegisteredSpy)

		await client.connect()

		assert.ok(onRegisteredSpy.calledOnce)
		assert.ok(onRegisteredSpy.calledWith(GRPC_PORT))
	})

	it('can provide client interceptors', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		const testService = getTestService()
		client.registerService(testService)
		await client.connect()

		const interceptorImplSpy = sinon.spy()

		const clientInterceptor = function (options, nextCall) {
			return new grpc.InterceptingCall(nextCall(options), {
				sendMessage: function (message, next) {
					interceptorImplSpy()
					next(message)
				},
			})
		}

		const interceptorSpy = sinon.spy(clientInterceptor)

		stub = await client.getStub(testService.routes, {
			interceptors: [interceptorSpy],
		})
		stub.testRpc = promisify(stub.testRpc).bind(stub)

		await stub.testRpc({ message: CLIENT_REQUEST_MESSAGE })

		assert.ok(interceptorSpy.calledOnce)
		assert.ok(interceptorImplSpy.calledOnce)
	})

	it('can provide server interceptors', async () => {
		const interceptorImplSpy = sinon.spy()

		const serverInterceptor = (_methodDescriptor, nextCall) => {
			const responder = new grpc.ResponderBuilder()
				.withSendMessage((message, next) => {
					interceptorImplSpy()
					next(message)
				})
				.build()
			return new grpc.ServerInterceptingCall(nextCall, responder)
		}

		const interceptorSpy = sinon.spy(serverInterceptor)

		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
			serverOptions: {
				interceptors: [interceptorSpy],
			},
		})

		const testService = getTestService()
		client.registerService(testService)
		await client.connect()

		stub = await client.getStub(testService.routes)
		stub.testRpc = promisify(stub.testRpc).bind(stub)
		await stub.testRpc({ message: CLIENT_REQUEST_MESSAGE })

		assert.ok(interceptorSpy.calledOnce)
		assert.ok(interceptorImplSpy.calledOnce)
	})

	it('uses lazy loaded protobuf for already used service', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		const loadCustomServiceSpy = sinon.spy(client.remoteServices, '_loadCustomService')

		const testService = getTestService()
		client.registerService(testService)
		await client.connect()

		stub = await client.getStub(testService.routes)
		stub.testRpc = promisify(stub.testRpc).bind(stub)
		stub.close()

		stub = await client.getStub(testService.routes)
		stub.testRpc = promisify(stub.testRpc).bind(stub)

		assert.ok(loadCustomServiceSpy.calledOnce)
		sinon.restore()
	})

	it('can use internal services', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		const testService = getTestInternalService()
		client.registerService(testService)

		await client.connect()

		stub = await client.getStub(testService.routes)
		stub.jsonRpc = promisify(stub.jsonRpc).bind(stub)

		const response = await stub.jsonRpc({ data: Buffer.from(CLIENT_REQUEST_MESSAGE) })

		assert.strictEqual(
			response.data.toString(),
			SERVER_RESPONSE_MESSAGE,
			'Received incorrect response message',
		)
	})

	it('can call other replicated service', async () => {
		const client1 = new ServiceClient({
			zk: process.env.ZK_HERA,
		})

		const client2 = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		const client2Replica = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT2,
		})

		const testService = getTestService()
		client2.registerService(testService)
		client2Replica.registerService(testService)

		try {
			await client1.connect()
			await client2.connect()
			await client2Replica.connect()

			stub = await client1.getStub(testService.routes)
			stub.testRpc = promisify(stub.testRpc).bind(stub)

			const response = await stub.testRpc({ message: CLIENT_REQUEST_MESSAGE })

			assert.strictEqual(
				response.message,
				SERVER_RESPONSE_MESSAGE,
				'Received incorrect response message',
			)
		} finally {
			stub.close()
			await client2.close()
			// wait for a while to test triggering of zk watch and
			// - updating of lazy loaded services
			await new Promise((resolve) => setTimeout(resolve, 100))
			await client2Replica.close()
			// wait for a while to test triggering of zk watch and
			// - removing of lazy loaded services
			await new Promise((resolve) => setTimeout(resolve, 100))
			await client1.close()
		}
	})

	it('throws on registration after connect', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})

		await client.connect()

		assert.throws(() => {
			client.registerService(getTestService())
		})
	})

	it('throws on incorrect service registration', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
		})

		let testService

		// ==================================================
		// ||				ROUTES							||
		// ==================================================
		// must be always provided

		assert.throws(() => {
			testService = getTestService()
			testService.routes = undefined
			client.registerService(testService)
		}, /must be provided/)

		// ==================================================
		// ||				SERVICE NAME					||
		// ==================================================
		// must be always provided

		assert.throws(() => {
			testService = getTestService()
			testService.serviceName = undefined
			client.registerService(testService)
		}, /must be provided/)

		// ==================================================
		// ||				HANDERLS						||
		// ==================================================
		// must be always provided

		assert.throws(() => {
			testService = getTestService()
			testService.handlers = undefined
			client.registerService(testService)
		}, /must be provided/)

		assert.throws(() => {
			testService = getTestService()
			testService.handlers = 'non-object'
			client.registerService(testService)
		}, /must be provided/)

		// ==================================================
		// ||				FILE NAME						||
		// ==================================================
		// must be provided for non-internal services

		assert.throws(() => {
			testService = getTestService()
			testService.filename = undefined
			client.registerService(testService)
		}, /must be provided/)
	})

	it('throws on stub retrieval before connect', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
		})

		const testService = getTestService()
		client.registerService(testService)

		assert.rejects(client.getStub(testService.routes))
	})

	it('throws on incorrect stub retrieval call', async () => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
			retryMaxAttempts: 0,
			retryDelay: 0,
		})

		await client.connect()

		assert.rejects(client.getStub('non-existing-route'))
	})
})
