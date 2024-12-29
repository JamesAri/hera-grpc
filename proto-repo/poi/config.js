module.exports = {
	protoPath: __dirname + '/poi.proto',
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'RouteGuide', // namespace
}
