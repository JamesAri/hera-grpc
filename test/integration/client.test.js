require('dotenv').config()

const assert = require('assert')

const { ServiceClient } = require('../..')

const GRPC_PORT = process.env.HERA_PORT || 50051

describe('Core ServiceClient integration tests', () => {
	let client = /** @type {import('../..').ServiceClient} */ (null)

	before(() => {
		client = new ServiceClient({
			zk: process.env.ZK_HERA,
			port: GRPC_PORT,
		})
	})

	after(async () => {
		await client.close()
	})

	it('can connect', async () => {
		await client.connect()
	})
})
