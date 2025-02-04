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

	const ServiceStub = protoDescriptor[serviceName]

	if (!ServiceStub) {
		throw new Error(`Service stub for '${serviceName}' not found in the loaded package definition`)
	}

	return ServiceStub
}

/**
 * Factory for loading service stubs and package definitions.
 * @param {{
* protoPath: string
* loadOptions: ?protoLoader.Options
* serviceName: string
* }} config
* @returns {protoLoader.PackageDefinition}
*/
const loadServiceFactory = (config) => () => {
	const packageDefinition = getPackageDefinition(config)
	const ServiceStub = getServiceStub(packageDefinition, config.serviceName)
	return {ServiceStub, packageDefinition}
}

module.exports = {
	getPackageDefinition,
	getServiceStub,
	loadServiceFactory,
}
