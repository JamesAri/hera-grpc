module.exports = class Service {
	constructor(serviceInfo, protoPath) {
		this.serviceInfo = serviceInfo
		this.name = serviceInfo.serviceName
		this.protoPath = protoPath
	}

	getServiceName() {
		return this.serviceInfo.serviceName
	}

	getRoute() {
		return this.serviceInfo.route
	}

	getConnection() {
		return {
			host: this.getHost(),
			port: this.getPort(),
		}
	}

	getHost() {
		return this.serviceInfo.host
	}

	getPort() {
		return this.serviceInfo.port
	}

	getServiceLoadConfig() {
		return {
			protoPath: this.protoPath,
			loadOptions: this.serviceInfo.loadOptions,
			serviceName: this.serviceInfo.serviceName,
		}
	}

	getId() {
		// should be unique
		return this.serviceInfo.znode
	}
}
