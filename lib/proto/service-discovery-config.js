module.exports = {
	protoPath: __dirname + '/service-discovery.proto',
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'ServiceDiscovery', // namespace
}
