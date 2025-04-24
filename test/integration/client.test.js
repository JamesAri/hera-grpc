const assert = require('assert')

const { ServiceClient } = require('../..')

describe('Core ServiceClient integration tests', () => {
	it('can connect', (done) => {
		const client = new ServiceClient({
			zk: process.env.ZK_HERA,
		})

		client.on('connected', () => {
			done()
		})
	})
})
