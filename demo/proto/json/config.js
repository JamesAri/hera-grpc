const path = require('path')
module.exports = {
	filename: path.join(__dirname, '/json.proto'),
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'Json',
}
