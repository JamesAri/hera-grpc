const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const Protobufjs = require('protobufjs')

/**
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

	const ServiceStub = protoDescriptor[serviceName]

	if (!ServiceStub) {
		throw new Error(`Service stub for '${serviceName}' not found in the loaded package definition`)
	}

	return { ServiceStub, packageDefinition }
}

/**
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
	const ServiceStub = protoDescriptor[serviceName]

	if (!ServiceStub) {
		throw new Error(`Service stub for '${serviceName}' not found in the loaded package definition`)
	}

	return { ServiceStub, packageDefinition }
}

/**
 * @param {string|string[]} protoPath
 */
const getProtoJsonDescriptorBuffer = (protoPath) => {
	const root = Protobufjs.loadSync(protoPath)
	return Buffer.from(JSON.stringify(root.toJSON()), 'utf-8')
}

const decodeLoadOptions = (loadOptions) => {
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
		// Only valid value is `String` (the global type)
		options.enums = options.enums === 'String' ? String : null
	}
	return options
}

const encodeLoadOptions = (loadOptions) => {
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
		// Only valid value is `String` (the global type)
		options.enums = options.enums === String ? 'String' : null
	}
	return options
}

module.exports = {
	loadServiceFromFile,
	loadServiceFromBuffer,
	getProtoJsonDescriptorBuffer,
	encodeLoadOptions,
	decodeLoadOptions,
}
