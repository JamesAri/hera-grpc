module.exports = {
	filename: __dirname + '/chat.proto',
	loadOptions: {
		keepCase: true,
		longs: String,
		enums: String,
		defaults: true,
		oneofs: true,
	},
	serviceName: 'ChatRoom', // namespace
}
