const assert = require('assert')

const grpc = require('@grpc/grpc-js')
const sinon = require('sinon')

const ClientParentInterceptor = require('../../../lib/interceptors/client-parent')

describe('ClientParentInterceptor', () => {
	const PARENT_CALL = { someKey: 'someValue' }

	let interceptor = /** @type {import('../../lib/interceptors/client-parent')} */ (null)

	beforeEach(() => {
		interceptor = new ClientParentInterceptor(PARENT_CALL)
		interceptor.options = {}
	})

	it('interceptor setups correctly', () => {
		const addParentCallStub = sinon.stub(interceptor, 'addParentCall').returns()
		const nextCall = () => {}
		const options = { testKey: 'testValue' }
		interceptor.interceptor(options, nextCall)
		assert.strictEqual(interceptor.options, options)
		assert.strictEqual(interceptor.nextCall, nextCall)
		assert.ok(addParentCallStub.calledOnce)
		sinon.restore()
	})

	it('should add parent call and propagate flags', () => {
		interceptor.options = {
			parent: null,
		}
		interceptor.addParentCall()
		assert.strictEqual(interceptor.options.parent, PARENT_CALL)
		assert.ok(interceptor.options.propagate_flags & grpc.propagate.DEADLINE)
		assert.ok(interceptor.options.propagate_flags & grpc.propagate.CANCELLATION)
	})

	it("shouldn't override user provided parent call", () => {
		const userProvidedParentCall = { userProvided: 'userProvided' }
		interceptor.options = {
			parent: userProvidedParentCall,
		}
		interceptor.addParentCall()
		assert.strictEqual(interceptor.options.parent, userProvidedParentCall)
		assert.ok(interceptor.options.propagate_flags & grpc.propagate.DEADLINE)
		assert.ok(interceptor.options.propagate_flags & grpc.propagate.CANCELLATION)
	})

	it("shouldn't override user provided parent call", () => {
		const propagateFlags = 0b1001
		const expectedPropagateFlags =
			propagateFlags | (grpc.propagate.DEADLINE | grpc.propagate.CANCELLATION)

		interceptor.options = {
			parent: null,
			propagate_flags: propagateFlags,
		}

		interceptor.addParentCall()

		assert.strictEqual(interceptor.options.parent, PARENT_CALL)
		assert.strictEqual(interceptor.options.propagate_flags, expectedPropagateFlags)
	})
})
