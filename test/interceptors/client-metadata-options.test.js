const assert = require('assert')

const grpc = require('@grpc/grpc-js')

const ClientMetadataOptionsInterceptor = require('../../lib/interceptors/client-metadata-options')

describe('ClientMetadataOptionsInterceptor', () => {
	let interceptor = /** @type {import('../../lib/interceptors/client-metadata-options')} */ (null)

	beforeEach(() => {
		interceptor = new ClientMetadataOptionsInterceptor()
	})

	it('sould set options', () => {
		const nextCall = () => {}
		const options = { testKey: 'testValue' }
		interceptor.interceptor(options, nextCall)
		assert.ok(interceptor.options)
		assert.strictEqual(interceptor.options.testKey, options.testKey)
	})

	it('should set default waitForReady metadata option', () => {
		const metadata = new grpc.Metadata()
		interceptor.start(metadata, {}, () => {})
		assert.ok(metadata.getOptions().waitForReady != null)
	})

	it('respects client waitForReady = true option', () => {
		const waitForReady = true
		const metadata = new grpc.Metadata({ waitForReady })
		interceptor.start(metadata, {}, () => {})
		assert.strictEqual(metadata.getOptions().waitForReady, waitForReady)
	})

	it('respects client waitForReady = false option', () => {
		const waitForReady = false
		const metadata = new grpc.Metadata({ waitForReady })
		interceptor.start(metadata, {}, () => {})
		assert.strictEqual(metadata.getOptions().waitForReady, waitForReady)
	})
})
