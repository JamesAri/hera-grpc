const assert = require('assert')

const sinon = require('sinon')
const grpc = require('@grpc/grpc-js')

const ServerOTLPInterceptor = require('../../lib/interceptors/server-otlp')

describe('ServerOTLPInterceptor', () => {
	let interceptor = /** @type {import('../../lib/interceptors/server-otlp')} */ (null)

	const METHOD_DESCRIPTOR = {
		path: 'GET 1234/test/path',
	}

	beforeEach(() => {
		interceptor = new ServerOTLPInterceptor()
		interceptor.methodDescriptor = METHOD_DESCRIPTOR
	})

	it('interceptor setups correctly', () => {
		const nextCall = () => {}
		const methodDescriptor = { a: '1' }
		interceptor.interceptor(methodDescriptor, nextCall)
		assert.strictEqual(interceptor.methodDescriptor, methodDescriptor)
		assert.strictEqual(interceptor.nextCall, nextCall)
	})

	it('should set start timestamp', () => {
		assert.ok(interceptor.timestamp.start == null)
		const nextSpy = sinon.spy()
		interceptor.start(nextSpy)
		assert.ok(interceptor.timestamp.start instanceof Date)
		assert.ok(nextSpy.calledOnce)
	})

	it('calls next with correct status', () => {
		const nextSpy = sinon.spy()
		const statusOK = {
			code: grpc.status.OK,
			details: 'test ok code',
		}
		interceptor.sendStatus(statusOK, nextSpy)
		assert.ok(nextSpy.calledOnce)
		assert.strictEqual(nextSpy.args[0][0].code, statusOK.code)
		assert.strictEqual(nextSpy.args[0][0].details, statusOK.details)

		const statusNOK = {
			code: grpc.status.INTERNAL,
			details: 'test error code',
		}
		interceptor.sendStatus(statusNOK, nextSpy)
		assert.ok(nextSpy.calledTwice)
		assert.strictEqual(nextSpy.args[1][0].code, statusNOK.code)
		assert.strictEqual(nextSpy.args[1][0].details, statusNOK.details)
	})
})
