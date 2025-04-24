const assert = require('assert')

const grpc = require('@grpc/grpc-js')
const sinon = require('sinon')

const ClientTracingInterceptor = require('../../../lib/interceptors/client-tracing')

describe('ClientTracingInterceptor', () => {
	const ROUTE = 'GET 1234/test/route'
	let interceptor = /** @type {import('../../../lib/interceptors/client-tracing')} */ (null)

	beforeEach(() => {
		interceptor = new ClientTracingInterceptor(ROUTE)
		interceptor.options = {}
	})

	it('interceptor setups correctly', () => {
		const enableTracingStub = sinon.stub(interceptor, 'enableTracing')
		const nextCall = () => {}
		const options = { testKey: 'testValue' }
		interceptor.interceptor(options, nextCall)
		assert.strictEqual(interceptor.nextCall, nextCall)
		assert.strictEqual(interceptor.options, options)
		assert.ok(enableTracingStub.calledOnce)
		sinon.restore()
	})

	it('should set default tracing', () => {
		interceptor.options = {}
		interceptor.enableTracing()
		assert.ok(interceptor.options.propagate_flags & grpc.propagate.CENSUS_STATS_CONTEXT)
		assert.ok(interceptor.options.propagate_flags & grpc.propagate.CENSUS_TRACING_CONTEXT)
	})

	it('should respect passed propagation flags', () => {
		const propagateFlags = 0b01011 | grpc.propagate.CANCELLATION | grpc.propagate.DEADLINE
		const expectedPropagateFlags =
			propagateFlags | (grpc.propagate.CENSUS_STATS_CONTEXT | grpc.propagate.CENSUS_TRACING_CONTEXT)

		interceptor.options = { propagate_flags: propagateFlags }

		interceptor.enableTracing()
		assert.strictEqual(interceptor.options.propagate_flags, expectedPropagateFlags)
	})

	it('should set hera-route in metadata', () => {
		const metadata = new grpc.Metadata()
		const listener = () => {}
		const next = sinon.spy()

		interceptor.start(metadata, listener, next)

		assert.ok(metadata.getMap()['hera-route'])
		assert.strictEqual(metadata.getMap()['hera-route'], ROUTE)
		assert.ok(next.calledOnce)
	})

	it('should set hera-forwarded-for in metadata', () => {
		const parentTracingString = 'parent-tracing-string'
		const parentMetadata = new grpc.Metadata()
		parentMetadata.add('hera-forwarded-for', parentTracingString)
		// parent call
		const parent = {
			metadata: parentMetadata,
		}

		const metadata = new grpc.Metadata()
		const listener = () => {}
		const next = sinon.spy()
		interceptor.options = { parent }
		interceptor.start(metadata, listener, next)

		assert.ok(metadata.getMap()['hera-forwarded-for'])
		assert.ok(metadata.getMap()['hera-forwarded-for'].includes(parentTracingString))
	})

	it('should work with parent call without tracing metadata', () => {
		const parent = {
			metadata: new grpc.Metadata(),
		}

		const metadata = new grpc.Metadata()
		const listener = () => {}
		const next = sinon.spy()
		interceptor.options = { parent }
		interceptor.start(metadata, listener, next)

		assert.ok(metadata.getMap()['hera-forwarded-for'])
	})
})
