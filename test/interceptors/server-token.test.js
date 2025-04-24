const assert = require('assert')

const grpc = require('@grpc/grpc-js')
const sinon = require('sinon')

const RPC_WHITE_LIST = require('../../lib/const/rpc-no-auth')
const ServerTokenInterceptor = require('../../lib/interceptors/server-token')

describe('ServerTokenInterceptor', () => {
	let interceptor = /** @type {import('../../lib/interceptors/server-token')} */ (null)

	const METHOD_DESCRIPTOR = {
		path: 'GET 1234/test/path',
	}

	beforeEach(() => {
		interceptor = new ServerTokenInterceptor()
		interceptor.methodDescriptor = METHOD_DESCRIPTOR
	})

	it('interceptor setups correctly', () => {
		const nextCall = () => {}
		const methodDescriptor = { a: '1' }
		interceptor.interceptor(methodDescriptor, nextCall)
		assert.strictEqual(interceptor.methodDescriptor, methodDescriptor)
		assert.strictEqual(interceptor.nextCall, nextCall)
	})

	it('should send UNAUTHENTICATED status on unauthenticated connections', () => {
		const sendStatusSpy = sinon.spy()
		const nextCallSpy = sinon.spy()
		interceptor.nextCall = {
			sendStatus: sendStatusSpy,
		}
		const metadata = new grpc.Metadata()
		interceptor.onReceiveMetadata(metadata, nextCallSpy)
		assert.ok(sendStatusSpy.calledOnce)
		assert.ok(sendStatusSpy.args[0][0])
		assert.strictEqual(sendStatusSpy.args[0][0].code, grpc.status.UNAUTHENTICATED)
		assert.ok(nextCallSpy.notCalled)
	})

	it('should allow connection for whitelisted service', () => {
		const sendStatusSpy = sinon.spy()
		const nextCallSpy = sinon.spy()
		interceptor.nextCall = {
			sendStatus: sendStatusSpy,
		}
		interceptor.methodDescriptor = {
			path: RPC_WHITE_LIST[0], // random whitelisted service
		}
		const metadata = new grpc.Metadata()
		interceptor.onReceiveMetadata(metadata, nextCallSpy)
		assert.ok(sendStatusSpy.notCalled)
		assert.ok(nextCallSpy.calledOnce)
		assert.strictEqual(nextCallSpy.args[0][0], metadata)
	})

	it('start calls next', () => {
		const nextCallSpy = sinon.spy()
		interceptor.start(nextCallSpy)
		assert.ok(nextCallSpy.calledOnce)
	})
})
