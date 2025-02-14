const GRPCClient = require('./grpc-client')

module.exports = class RemoteService {
	constructor(host, port, serviceName, ServiceStub, packageDefinition) {
		this.host = host
		this.port = port
		this.serviceName = serviceName

		this.grpcClient = new GRPCClient({host, port, ServiceStub, packageDefinition})
	}

	close() {
		this.grpcClient.close()
	}

	connect() {
		this.grpcClient.connect()
		return this.grpcClient.getClient()
	}
}
