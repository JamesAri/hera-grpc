const path = require('path')

const loadOptions = {
	keepCase: true,
	longs: String,
	enums: String,
	defaults: true,
	oneofs: true,
	includeDirs: [path.join(__dirname, './messages')],
}

module.exports = {
	filename: path.join(__dirname, '/services/test-service.proto'),
	loadOptions,
	serviceName: 'test.services.package.TestService', // namespace
	messageName: 'test.messages.package.TestMessage', // namespace
}
