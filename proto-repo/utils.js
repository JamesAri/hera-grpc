const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

/**
 * Utility for loading .proto files package definitions.
 * @param {{
 * protoPath: string
 * loadOptions: ?protoLoader.Options
 * }} serviceConfig
 * @returns {protoLoader.PackageDefinition}
 */
function getPackageDefinition(serviceConfig) {
	const {protoPath, loadOptions} = serviceConfig
	return protoLoader.loadSync(protoPath, loadOptions)
}

/**
 * Utility for loading .proto files service stubs.
 * @param {protoLoader.PackageDefinition} packageDefinition
 * @param {string} serviceName
 * @returns {grpc.GrpcObject | grpc.ServiceClientConstructor | grpc.ProtobufTypeDefinition}
 */
function getServiceStub(packageDefinition, serviceName) {
	const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)

	if (!serviceName) {
		throw new Error('Service name missing')
	}

	const serviceStub = protoDescriptor[serviceName]
	if (!serviceStub) {
		throw new Error(`Service stub for '${serviceName}' not found in proto definition`)
	}

	// TODO check return type and edit jsdoc
	return serviceStub
}

module.exports = {
	getPackageDefinition,
	getServiceStub,
}
