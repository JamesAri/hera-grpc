module.exports = {
	protoPath: __dirname + '/proto/schema.proto',
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'RouteGuide', // namespace
}
