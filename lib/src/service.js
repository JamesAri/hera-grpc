const GRPCClient = require('./grpc-client')

module.exports = class Service {
	constructor(host, port, ServiceStub, packageDefinition) {
		this.host = host
		this.port = port

		this.client = new GRPCClient({ServiceStub, packageDefinition})
		this.connected = false
	}

	close() {
		if (this.connected) {
			this.client.close()
			this.connected = false
		}
	}

	connect() {
		if (!this.connected) {
			this.client.connect(this.host, this.port)
		}
		return this.client
	}

	getClient() {
		return this.client
	}

	getConnection() {
		return {
			host: this.host,
			port: this.port
		}
	}
}
