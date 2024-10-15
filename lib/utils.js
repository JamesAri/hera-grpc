const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

/**
 * @param {{pathToProtoFile: strin | string[], loadOptions: ?protoLoader.Options, packageName: string, serviceName: string}} settings
 * @returns
 */
function getService({pathToProtoFile, loadOptions, packageName, serviceName}) {
	const packageDefinition = protoLoader.loadSync(pathToProtoFile, loadOptions)
	// This is protoDescriptor
	const loadedDefinition = grpc.loadPackageDefinition(packageDefinition)

	// if (!loadedDefinition[packageName]) {
	// 	throw new Error(`Service entity '${packageName}' not found in package definition`)
	// }
	// const serviceContainer = loadedDefinition[packageName][serviceName]

	const serviceContainer = loadedDefinition[serviceName]

	if (!serviceContainer) {
		throw new Error('Service stub not found in proto definition')
	}

	const {service} = serviceContainer

	if (!service) {
		throw new Error('Service descriptor not found in service stub')
	}

	return service
}

module.exports = {
	getService,
}
