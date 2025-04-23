const assert = require('assert')

const grpc = require('@grpc/grpc-js')

const ClientDeadlineInterceptor = require('../../lib/interceptors/client-deadline')

describe('ClientDeadlineInterceptor', () => {
	let interceptor = null

	beforeEach(() => {
		interceptor = new ClientDeadlineInterceptor()
	})

	it('should set default deadline', () => {
		interceptor.options = {}
		interceptor.addDefaultDeadline()
		assert.ok(interceptor.options.deadline instanceof Date)
	})

	describe('should set passed deadline', () => {
		it('on date', () => {
			const deadline = new Date(Date.now() + 1000)
			interceptor.options = {
				deadline,
			}
			interceptor.addDefaultDeadline()
			assert.strictEqual(deadline, interceptor.options.deadline)
		})

		it('on number', () => {
			const deadline = Date.now() + 1000
			interceptor.options = {
				deadline: deadline,
			}
			interceptor.addDefaultDeadline()
			assert.strictEqual(interceptor.options.deadline, deadline)
		})
	})

	describe('should set infinite deadline', () => {
		it('on null', () => {
			interceptor.options = {
				deadline: null,
			}
			interceptor.addDefaultDeadline()
			assert.strictEqual(interceptor.options.deadline, undefined)
		})

		it('on deadline <= 0', () => {
			interceptor.options = {
				deadline: 0,
			}
			interceptor.addDefaultDeadline()
			assert.strictEqual(interceptor.options.deadline, undefined)
		})
	})

	describe('should respect parent deadline', () => {
		it('deadline > 0', () => {
			interceptor.options = {
				parent: true,
				propagate_flags: grpc.propagate.DEADLINE,
				deadline: Date.now() + 1000,
			}
			interceptor.addDefaultDeadline()
			assert.strictEqual(interceptor.options.deadline, undefined)
		})

		it('deadline <= 0', () => {
			interceptor.options = {
				parent: true,
				propagate_flags: grpc.propagate.DEADLINE,
				deadline: 0,
			}
			interceptor.addDefaultDeadline()
			assert.strictEqual(interceptor.options.deadline, undefined)
		})

		it('deadline === null', () => {
			interceptor.options = {
				parent: true,
				propagate_flags: grpc.propagate.DEADLINE,
				deadline: null,
			}
			interceptor.addDefaultDeadline()
			assert.strictEqual(interceptor.options.deadline, undefined)
		})
	})
})
