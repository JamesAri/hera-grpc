const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

/**
 * Utility for loading .proto files service stubs.
 * @param {{
 * protoPath: string
 * serviceName: string
 * loadOptions: ?protoLoader.Options
 * }} serviceConfig
 * @returns {grpc.GrpcObject | grpc.ServiceClientConstructor | grpc.ProtobufTypeDefinition}
 */
function getServiceStubConstructor(serviceConfig) {
	const {protoPath, serviceName, loadOptions} = serviceConfig
	const packageDefinition = protoLoader.loadSync(protoPath, loadOptions)

	const protoDescriptor = grpc.loadPackageDefinition(packageDefinition)

	const serviceStub = protoDescriptor[serviceName]

	if (!serviceStub) {
		throw new Error(`Service stub for '${serviceName}' not found in proto definition`)
	}
	// TODO check return type and edit jsdoc
	return serviceStub
}

module.exports = {
	getServiceStubConstructor,
}
