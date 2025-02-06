const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const Protobufjs = require('protobufjs')

/**
 * Factory for loading service stubs and package definitions from proto files.
 * @param {{
 * protoPath: string
 * serviceName: string
 * loadOptions: ?protoLoader.Options
 * }} config
 * @returns {{ ServiceStub: grpc.ServiceDefinition, packageDefinition: protoLoader.PackageDefinition }}
 */
const loadServiceFromFile = ({ protoPath, serviceName, loadOptions }) => {
	if (!protoPath) {
		throw new Error('loadServiceFromFile - missing proto file')
	}
	if (!serviceName) {
		throw new Error('loadServiceFromFile - missing service name')
	}
	const packageDefinition = protoLoader.loadSync(protoPath, loadOptions)

	const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)

	const ServiceStub = protoDescriptor[serviceName]

	if (!ServiceStub) {
		throw new Error(`Service stub for '${serviceName}' not found in the loaded package definition`)
	}

	return { ServiceStub, packageDefinition }
}

/**
 * Factory for loading service stubs and package definitions from proto
 * Buffer containing JSON descriptor of the service.
 * @param {{
 * protoBuffer: Buffer
 * serviceName: string
 * loadOptions: ?protoLoader.Options
 * }} config
 * @returns {{ ServiceStub: grpc.ServiceDefinition, packageDefinition: protoLoader.PackageDefinition }}
 */
const loadServiceFromBuffer = ({ protoBuffer, serviceName, loadOptions }) => {
	if (!protoBuffer) {
		throw new Error('loadServiceFromBuffer - missing proto buffer')
	}
	if (!serviceName) {
		throw new Error('loadServiceFromBuffer - missing service name')
	}

	let packageDefinition = null
	try {
		const jsonDescriptor = JSON.parse(protoBuffer.toString('utf-8'))
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

module.exports = {
	loadServiceFromFile,
	loadServiceFromBuffer,
	getProtoJsonDescriptorBuffer,
}
