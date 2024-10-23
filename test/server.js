const assert = require('assert')

const {GRPCServer} = grpc

describe('GRPCServer', () => {
	describe('constructor', () => {
		it('should be a class', () => {
			assert.strictEqual(typeof GRPCServer, 'function')
		})
		it('should have a constructor', () => {
			assert.strictEqual(typeof GRPCServer.prototype.constructor, 'function')
		})
		it('should construct', () => {
			const server = new GRPCServer()
			assert(server)
		})
	})
})
