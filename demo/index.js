const grpc = require('@grpc/grpc-js')
const {getFeature, listFeatures, recordRoute, routeChat} = require('./services')
const {getService} = require('../lib/utils')

const settings = {
	pathToProtoFile: __dirname + '/../protos/schema.proto', // protoDescriptor.routeguide.RouteGuide.service
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true
	},
	packageName: 'routeguide', // namespace
	serviceName: 'RouteGuide' // stub constructor / stub
}


const service = getService(settings)

const server = new grpc.Server()

server.addService(service, {
	getFeature,
	listFeatures,
	recordRoute,
	routeChat,
})


server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), (error, port) => {
	if (error) {
		console.error(`Server binding failed: ${error.message}`)
		return
	}
	  console.log(`Server running at http://0.0.0.0:${port}`)
	// routeServer.start()
})
