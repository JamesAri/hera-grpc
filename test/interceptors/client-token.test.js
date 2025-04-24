const assert = require('assert')

const grpc = require('@grpc/grpc-js')
const sinon = require('sinon')

const ClientTokenInterceptor = require('../../lib/interceptors/client-token')

describe('ClientTokenInterceptor', () => {
	let interceptor = /** @type {import('../../lib/interceptors/client-token')} */ (null)

	beforeEach(() => {
		interceptor = new ClientTokenInterceptor()
		interceptor.options = {}
	})

	it('interceptor setups correctly', () => {
		const nextCall = () => {}
		const options = { testKey: 'testValue' }
		interceptor.interceptor(options, nextCall)
		assert.strictEqual(interceptor.options, options)
		assert.strictEqual(interceptor.nextCall, nextCall)
	})

	it('should set hera-token in metadata', () => {
		const metadata = new grpc.Metadata()
		const listener = () => {}
		const next = sinon.spy()

		interceptor.start(metadata, listener, next)

		assert.ok(metadata.getMap()['hera-token'])
		assert.ok(next.calledOnce)
	})
})
