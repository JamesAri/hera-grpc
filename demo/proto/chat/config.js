const path = require('path')

// TODO: try import message-type.proto and not include it in chat.proto
module.exports = {
	filename: [
		path.join(__dirname, '/chat.proto'),
		path.join(__dirname, '/nested/message-type.proto'),
	],
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'ChatRoom',
}
