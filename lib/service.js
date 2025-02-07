module.exports = class Service {
	constructor(host, port, ServiceStub, packageDefinition) {
		this.host = host
		this.port = port
		this.ServiceStub = ServiceStub
		this.packageDefinition = packageDefinition
	}

	getConnection() {
		return {
			host: this.host,
			port: this.port
		}
	}

	getPackageDefinition() {
		return this.packageDefinition
	}

	getServiceStub() {
		return this.ServiceStub
	}
}
