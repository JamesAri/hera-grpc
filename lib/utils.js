const fs = require('fs')
const os = require('os')
const path = require('path')

const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const debugRetry = require('debug')('utils-retry')
const debugResolve = require('debug')('utils-resolve')
const Protobufjs = require('protobufjs')

/**
 * Utility to traverse gRPC object hierarchy and get the service stub contructor.
 *
 * @param {string} serviceName
 * @param {grpc.GrpcObject} protoDescriptor gRPC object hierarchy
 * @returns {grpc.ServiceDefinition}
 */
const getServiceStub = (serviceName, protoDescriptor) => {
	if (typeof serviceName !== 'string') {
		throw new Error('getServiceStub - service name must be a string')
	}
	// e.g. hera.srv.v1.LogService (package notation)
	const fields = serviceName.split('.')
	let ServiceStub = protoDescriptor
	for (const field of fields) {
		ServiceStub = ServiceStub[field]
		if (!ServiceStub) {
			throw new Error(
				`Service stub for '${serviceName}' not found in the loaded package definition`,
			)
		}
	}
	return ServiceStub
}
exports.getServiceStub = getServiceStub

/**
 * Loads stub contructor and package definition from a proto file.
 *
 * @param {string | string[]} filename One or multiple file paths to load. Can be an absolute path or relative to an include path.
 * @param {string} serviceName
 * @param {?protoLoader.Options} loadOptions
 * @returns {{ ServiceStub: grpc.ServiceDefinition, packageDefinition: protoLoader.PackageDefinition }}
 */
const loadServiceFromFile = (filename, serviceName, loadOptions) => {
	if (!filename) {
		throw new Error('loadServiceFromFile - missing proto filename')
	}
	if (!serviceName) {
		throw new Error('loadServiceFromFile - missing service name')
	}
	const packageDefinition = protoLoader.loadSync(filename, loadOptions)
	const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)
	const ServiceStub = getServiceStub(serviceName, protoDescriptor)

	return { ServiceStub, packageDefinition }
}
exports.loadServiceFromFile = loadServiceFromFile

/**
 * Loads stub contructor and package definition from a JSON descriptor buffer.
 *
 * @param {Buffer} buffer Buffer containing JSON descriptor of the service
 * @param {string} serviceName
 * @param {?protoLoader.Options} loadOptions
 * @returns {{ ServiceStub: grpc.ServiceDefinition, packageDefinition: protoLoader.PackageDefinition }}
 */
const loadServiceFromBuffer = (buffer, serviceName, loadOptions) => {
	if (!buffer) {
		throw new Error('loadServiceFromBuffer - missing proto buffer')
	}
	if (!serviceName) {
		throw new Error('loadServiceFromBuffer - missing service name')
	}

	let packageDefinition = null
	try {
		const jsonDescriptor = JSON.parse(buffer.toString('utf-8'))
		packageDefinition = protoLoader.fromJSON(jsonDescriptor, loadOptions)
	} catch (error) {
		throw new Error(`JSON parse error - failed to parse proto buffer: ${error.message}}`)
	}

	const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)
	const ServiceStub = getServiceStub(serviceName, protoDescriptor)

	return { ServiceStub, packageDefinition }
}
exports.loadServiceFromBuffer = loadServiceFromBuffer

/**
 * Adds grpc-loader includeDirs support to protobufjs.
 *
 * @param {Protobufjs.Root} root
 * @param {string[]} includeDirs array of paths resolve imports
 */
const protobufjsIncludeDirsSupportHook = (root, includeDirs) => {
	// https://protobufjs.github.io/protobuf.js/Root.html#resolvePath
	root.resolvePath = (origin, target) => {
		// First try default resolution
		const defaultPath = path.resolve(path.dirname(origin), target)
		if (fs.existsSync(defaultPath)) {
			debugResolve(`Resolved (default) import: ${target} -> ${defaultPath}`)
			return defaultPath
		}
		// Check includeDirs
		for (const dir of includeDirs) {
			const fullPath = path.resolve(dir, target)
			if (fs.existsSync(fullPath)) {
				debugResolve(`Resolved import: ${target} -> ${fullPath}`)
				return fullPath
			}
		}
		throw new Error(`Unable to resolve import: ${target}`)
	}
}

/**
 * Loads a proto file and returns a JSON descriptor buffer.
 *
 * @param {string|string[]} protoPath path(s) to the proto file(s)
 * @param {?protoLoader.Options} loadOptions
 * @returns {Buffer} JSON descriptor buffer of the proto file(s)
 * @see https://github.com/protobufjs/protobuf.js/blob/master/README.md#using-json-descriptors
 */
const getProtoJsonDescriptorBuffer = (protoPath, loadOptions) => {
	const root = new Protobufjs.Root()

	const includeDirs = loadOptions?.includeDirs
	includeDirs && protobufjsIncludeDirsSupportHook(root, includeDirs)

	root.loadSync(protoPath, loadOptions)

	return Buffer.from(JSON.stringify(root.toJSON()), 'utf-8')
}
exports.getProtoJsonDescriptorBuffer = getProtoJsonDescriptorBuffer

/**
 * @see https://www.npmjs.com/package/@grpc/proto-loader
 */
const deserializeLoadOptions = (loadOptions) => {
	if (!loadOptions) {
		return loadOptions
	}
	const options = { ...loadOptions }
	if (options.longs) {
		options.longs = options.longs === 'Number' ? Number : String
	}
	if (options.bytes) {
		options.bytes = options.bytes === 'Array' ? Array : String
	}
	if (options.enums) {
		// Only valid value is String (the global type)
		options.enums = options.enums === 'String' ? String : null
	}
	return options
}
exports.deserializeLoadOptions = deserializeLoadOptions

/**
 * @see https://www.npmjs.com/package/@grpc/proto-loader
 */
const serializeLoadOptions = (loadOptions) => {
	if (!loadOptions) {
		return loadOptions
	}
	const options = { ...loadOptions }
	if (options.longs) {
		options.longs = options.longs === Number ? 'Number' : 'String'
	}
	if (options.bytes) {
		options.bytes = options.bytes === Array ? 'Array' : 'String'
	}
	if (options.enums) {
		// Only valid value is String (the global type)
		options.enums = options.enums === String ? 'String' : null
	}
	return options
}
exports.serializeLoadOptions = serializeLoadOptions

/**
 * Function to retry.
 * @name ToRetry
 * @function
 * @param {}
 */
/**
 * Retry function with constant backoff.
 * @param {Number} retries max number of attempts
 * @param {Number} delay in milliseconds
 * @param {ToRetry} fn
 * @throws {Error} when max attempts reached containing the last error
 * @returns {Promise<any>} the result of the successful attempt
 */
const retry = async (retries, delay, fn) => {
	try {
		return await fn()
	} catch (error) {
		debugRetry(`Retry error: ${error.message}`)
		if (retries > 0) {
			debugRetry(`Retrying... attempts left: ${retries}`)
			await new Promise((resolve) => setTimeout(resolve, delay))
			return retry(retries - 1, delay, fn)
		}
		throw new Error(`Retries failed, last error: ${error}`)
	}
}
exports.retry = retry

/**
 * Shuffle an array in place, modifying the original array.
 * (Fisher-Yates algorithm)
 * @param {*} array
 * @returns
 */
const shuffle = (array) => {
	let currentIndex = array.length

	// While there remain elements to shuffle...
	while (currentIndex !== 0) {
		// Pick a remaining element...
		const randomIndex = Math.floor(Math.random() * currentIndex)
		currentIndex--

		// And swap it with the current element.
		;[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
	}
	return array
}
exports.shuffle = shuffle

/**
 * Sets metadata options if the key is not already set.
 *
 * @param {grpc.Metadata} metadata
 * @param {string} key
 * @param {string} option
 */
const setDefaultMetadataOptions = (metadata, key, option) => {
	if (metadata.getOptions()[key] === undefined) {
		const options = { ...metadata.options }
		options[key] = option
		metadata.setOptions(options)
	}
}
exports.setDefaultMetadataOptions = setDefaultMetadataOptions

/**
 * Sets metadata value if the key is not already set.
 *
 * @param {grpc.Metadata} metadata
 * @param {string} key
 * @param {string} value
 */
const setDefaultMetadataValue = (metadata, key, value) => {
	if (metadata.get(key).length === 0) {
		metadata.set(key, value)
	}
}
exports.setDefaultMetadataValue = setDefaultMetadataValue

/**
 * @returns {string} The public IPv4 address of the machine
 */
const getPublicInterface = function () {
	const object = os.networkInterfaces()

	for (const iface in object) {
		for (const addr of object[iface]) {
			if (addr.family === 'IPv4' && !addr.internal) {
				return addr.address
			}
		}
	}
	return null
}
exports.getPublicInterface = getPublicInterface
