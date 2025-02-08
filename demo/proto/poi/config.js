const path = require('path')
module.exports = {
	filename: path.join(__dirname, '/poi.proto'),
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'RouteGuide', // namespace
}
