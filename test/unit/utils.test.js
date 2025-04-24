const assert = require('assert')
const os = require('os')

const grpc = require('@grpc/grpc-js')
const sinon = require('sinon')

const {
	setDefaultMetadataOptions,
	setDefaultMetadataValue,
	loadServiceFromFile,
	getProtoJsonDescriptorBuffer,
	loadServiceFromBuffer,
	deserializeLoadOptions,
	serializeLoadOptions,
	getServiceStub,
	getPublicInterface,
	retry,
	shuffle,
} = require('../../lib/utils')
const PROTO_CONFIG = require('../fixtures/proto-test-config')

describe('utils tests', () => {
	const { filename, loadOptions, serviceName, messageName } = PROTO_CONFIG

	describe('metadata utils', () => {
		it('setDefaultMetadataOptions sets option', () => {
			const metadata = new grpc.Metadata()
			const key = 'key1'
			const option = 'option1'
			setDefaultMetadataOptions(metadata, key, option)
			assert.strictEqual(metadata.options[key], option)
		})

		it("setDefaultMetadataOptions doesn't sets option", () => {
			const metadata = new grpc.Metadata()
			const key = 'key1'
			const optionOld = 'option_new'
			metadata.setOptions({ [key]: optionOld })

			const optionNew = 'option_new'
			setDefaultMetadataOptions(metadata, key, optionNew)
			assert.strictEqual(metadata.options[key], optionOld)
		})

		it('setDefaultMetadataValue sets value', () => {
			const metadata = new grpc.Metadata()
			const key = 'key1'
			const value = 'value1'
			setDefaultMetadataValue(metadata, key, value)
			assert.strictEqual(metadata.get(key)[0], value)
		})

		it("setDefaultMetadataValue doesn't sets value", () => {
			const metadata = new grpc.Metadata()
			const key = 'key1'
			const valueOld = 'value_old'
			metadata.set(key, valueOld)
			const valueNew = 'value_new'
			setDefaultMetadataValue(metadata, key, valueNew)
			assert.strictEqual(metadata.get(key)[0], valueOld)
		})
	})

	describe('loading proto files', () => {
		it('getServiceStub throws on non-string service name', () => {
			const protoDescriptor = {} // === ServiceStub
			assert.throws(() => {
				getServiceStub({}, protoDescriptor)
			}, /service name must be a string/)
		})

		it('getServiceStub throws on missing service name', () => {
			const protoDescriptor = {} // === ServiceStub
			assert.throws(() => {
				getServiceStub('wrong.name.Service', protoDescriptor)
			}, /not found in the loaded package definition/)
		})

		it('loadServiceFromFile loads service', () => {
			const { packageDefinition, ServiceStub } = loadServiceFromFile(
				filename,
				serviceName,
				loadOptions,
			)
			assert.ok(ServiceStub)
			assert.ok(packageDefinition)
			assert.ok(packageDefinition[serviceName])
			assert.ok(packageDefinition[messageName])
		})

		it('loadServiceFromFile throws on missing filename', () => {
			assert.throws(() => {
				loadServiceFromFile(undefined, serviceName, loadOptions)
			}, /missing proto filename/)
		})

		it('loadServiceFromFile throws on missing service name', () => {
			assert.throws(() => {
				loadServiceFromFile(filename, undefined, loadOptions)
			}, /missing service name/)
		})

		it('getProtoJsonDescriptorBuffer returns buffer', () => {
			const buffer = getProtoJsonDescriptorBuffer(filename, loadOptions.includeDirs)
			assert.ok(buffer)
			assert.ok(Buffer.isBuffer(buffer))
		})

		it('getProtoJsonDescriptorBuffer throws on wrong includeDirs when unable to resolve import', () => {
			const wrongIncludeDirs = ['wrong/path']
			assert.throws(() => {
				getProtoJsonDescriptorBuffer(filename, wrongIncludeDirs)
			}, /Unable to resolve import/)
		})

		it('loadServiceFromBuffer loads service', () => {
			const buffer = getProtoJsonDescriptorBuffer(filename, loadOptions.includeDirs)
			const { packageDefinition, ServiceStub } = loadServiceFromBuffer(
				buffer,
				serviceName,
				loadOptions,
			)
			assert.ok(ServiceStub)
			assert.ok(packageDefinition)
			assert.ok(packageDefinition[serviceName])
			assert.ok(packageDefinition[messageName])
		})

		it('loadServiceFromBuffer throws on missing buffer', () => {
			assert.throws(() => {
				loadServiceFromBuffer(undefined, serviceName, loadOptions)
			}, /missing proto buffer/)
		})

		it('loadServiceFromBuffer throws on missing service name', () => {
			assert.throws(() => {
				loadServiceFromBuffer(Buffer.from(''), undefined, loadOptions)
			}, /missing service name/)
		})

		it('loadServiceFromBuffer throws on JSON parse error', () => {
			assert.throws(() => {
				loadServiceFromBuffer(Buffer.from('invalid json'), serviceName, loadOptions)
			}, /JSON parse error/)
		})
	})

	describe('serializing and deserializing load options', () => {
		it('serializeLoadOptions serializes load options with String', () => {
			const loadOptions = {
				keepCase: true,
				bytes: String,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			}
			const serialized = serializeLoadOptions(loadOptions)
			assert.deepStrictEqual(serialized, {
				keepCase: true,
				bytes: 'String',
				longs: 'String',
				enums: 'String',
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			})
		})

		it('serializeLoadOptions serializes load options with Array', () => {
			const loadOptions = {
				keepCase: true,
				bytes: Array,
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			}
			const serialized = serializeLoadOptions(loadOptions)
			assert.deepStrictEqual(serialized, {
				keepCase: true,
				bytes: 'Array',
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			})
		})

		it('serializeLoadOptions serializes load options with Number', () => {
			const loadOptions = {
				keepCase: true,
				longs: Number,
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			}
			const serialized = serializeLoadOptions(loadOptions)
			assert.deepStrictEqual(serialized, {
				keepCase: true,
				longs: 'Number',
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			})
		})

		it('serializeLoadOptions serializes enums load options to null', () => {
			const loadOptions = {
				enums: Number,
			}
			const deserialized = serializeLoadOptions(loadOptions)
			assert.deepStrictEqual(deserialized, {
				enums: null,
			})
		})

		it('deserializeLoadOptions deserializes load options with Number', () => {
			const serializedLoadOptions = {
				keepCase: true,
				longs: 'Number',
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			}
			const deserialized = deserializeLoadOptions(serializedLoadOptions)
			assert.deepStrictEqual(deserialized, {
				keepCase: true,
				longs: Number,
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			})
		})

		it('deserializeLoadOptions deserializes load options with String', () => {
			const serializedLoadOptions = {
				keepCase: true,
				bytes: 'String',
				longs: 'String',
				enums: 'String',
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			}
			const deserialized = deserializeLoadOptions(serializedLoadOptions)
			assert.deepStrictEqual(deserialized, {
				keepCase: true,
				bytes: String,
				longs: String,
				enums: String,
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			})
		})

		it('deserializeLoadOptions deserializes load options with Array', () => {
			const serializedLoadOptions = {
				keepCase: true,
				bytes: 'Array',
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			}
			const deserialized = deserializeLoadOptions(serializedLoadOptions)
			assert.deepStrictEqual(deserialized, {
				keepCase: true,
				bytes: Array,
				defaults: true,
				oneofs: true,
				includeDirs: 'some dir',
			})
		})

		it('deserializeLoadOptions deserializes enums load options to null', () => {
			const serializedLoadOptions = {
				enums: 'Number',
			}
			const deserialized = deserializeLoadOptions(serializedLoadOptions)
			assert.deepStrictEqual(deserialized, {
				enums: null,
			})
		})

		it('deserializeLoadOptions returns undefined for undefined input', () => {
			const serializedLoadOptions = undefined
			const deserializedLoadOptions = deserializeLoadOptions(serializedLoadOptions)
			assert.strictEqual(deserializedLoadOptions, serializedLoadOptions)
		})

		it('serializeLoadOptions returns undefined for undefined input', () => {
			const loadOptions = undefined
			const serializedLoadOptions = serializeLoadOptions(loadOptions)
			assert.strictEqual(serializedLoadOptions, loadOptions)
		})
	})

	describe('retry', () => {
		it('retry success', async () => {
			let count = 0
			const retries = 5
			const delay = 10 // ms
			const fn = () => {
				count++
				if (count < 3) {
					throw new Error('Test error')
				}
				return 'Success'
			}
			const result = await retry(retries, delay, fn)
			assert.strictEqual(result, 'Success')
			assert.strictEqual(count, 3)
		})

		it('retry failure', async () => {
			let count = 0
			const retries = 2
			const delay = 10 // ms
			const fn = () => {
				count++
				throw new Error('Test error')
			}
			await assert.rejects(() => {
				return retry(retries, delay, fn)
			}, /Test error/)
			assert.strictEqual(count, 3)
		})
	})

	describe('getPublicInterface', () => {
		afterEach(() => sinon.restore()) // put originals back

		it('returns the public IPv4', () => {
			sinon.stub(os, 'networkInterfaces').returns({
				eth0: [
					{ family: 'IPv6', internal: false, address: 'fe80::1' },
					{ family: 'IPv4', internal: false, address: '192.168.1.1' },
				],
				lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
			})
			assert.equal(getPublicInterface(), '192.168.1.1')
		})

		it('returns null when none found', () => {
			sinon.stub(os, 'networkInterfaces').returns({})
			assert.equal(getPublicInterface(), null)
		})
	})

	it('shuffle', () => {
		const array = [1, 2, 3, 4, 5]
		const shuffledArray = [...array]
		shuffle(shuffledArray)
		assert.notDeepStrictEqual(shuffledArray, array)
		assert.strictEqual(shuffledArray.length, array.length)
		assert.ok(shuffledArray.every((item) => array.includes(item)))
	})
})
