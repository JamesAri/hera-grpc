const debug = require('debug')('remote-services')

const GRPCClient = require('./grpc-client')
const { loadServiceFromBuffer } = require('./utils')

module.exports = class RemoteServices {
	constructor({ zookeeper }) {
		this.zookeeper = zookeeper

		/**
		 * Services by route as mapped and returned from zk =>
		 * { route: { host, port, serviceZnode, protoZnode, serviceName, loadOptions} }
		 */
		this.servicesByRoute = {}

		// lazy loaded services (grpc-clients) by route
		this.loadedServices = {}
	}

	update(servicesByRoute) {
		this.servicesByRoute = servicesByRoute

		for (const route in this.loadedServices) {
			debug(`Updating loaded service | route: ${route}`)

			if (!this.servicesByRoute[route]) {
				debug(`Removing loaded service | route: ${route}`)
				this.loadedServices[route].setConnections([])
				delete this.loadedServices[route]
				continue
			}

			debug(`Current connections: ${this.loadedServices[route].getConnections()}`)

			const availableConnections = servicesByRoute[route].map(
				(service) => `${service.host}:${service.port}`,
			)

			this.loadedServices[route].setConnections(availableConnections)

			debug(`Updated connections: ${this.loadedServices[route].getConnections()}`)
		}
	}

	async _getProtoBuffer(znode) {
		try {
			const jsonDescriptorBuffer = await this.zookeeper.getData(znode)
			return jsonDescriptorBuffer
		} catch (error) {
			if (error.name === 'NO_NODE') {
				debug(`Znode ${znode} was deleted - service not available anymore`)
			}
		}
		return null
	}

	/**
	 * invoked on each client.getStub
	 * @param {string} route
	 * @returns {GRPCClient}
	 */
	async getService(route) {
		debug(`Looking for service with route ${route}`)

		if (this.loadedServices[route]) {
			debug(`Using already loaded service with route ${route}`)
			return this.loadedServices[route]
		}

		const availableServices = this.servicesByRoute[route]

		if (!availableServices) {
			debug(`No services found for route ${route}`)
			return null
		}

		// Retrieve proto info from one of the duplicated services.
		// TODO: have just one proto service definition in zk:
		// => we need "custom znode" that persist while there are some services for it
		// => zk containers could achieve that, but there is no support for it yet
		const { serviceName, protoZnode, loadOptions } = availableServices[0]

		if (!serviceName) {
			debug(`Malformed service data for route: ${route}, missing service name`)
			return null
		}

		const jsonDescriptorBuffer = await this._getProtoBuffer(protoZnode)

		if (!jsonDescriptorBuffer) {
			debug(`Proto buffer node with no data found: ${protoZnode}`)
			return null
		}

		const { ServiceStub, packageDefinition } = loadServiceFromBuffer(
			jsonDescriptorBuffer,
			serviceName,
			loadOptions,
		)

		const availableConnections = availableServices.map(
			(service) => `${service.host}:${service.port}`,
		)

		this.loadedServices[route] = new GRPCClient({
			route,
			connections: availableConnections,
			serviceName,
			ServiceStub,
			packageDefinition,
		})

		debug(
			`New ${serviceName} service added to loaded services | ${route} | [${availableConnections}]`,
		)
		return this.loadedServices[route]
	}
}
