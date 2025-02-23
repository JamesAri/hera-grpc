const debug = require('debug')('remote-services')

const GRPCClient = require('./grpc-client')
const internalServices = require('./proto/internal-services')
const { loadServiceFromBuffer, loadServiceFromFile } = require('./utils')

module.exports = class RemoteServices {
	constructor({ zookeeper }) {
		this.zookeeper = zookeeper

		/** As mapped from zk.watchServices() */
		this.servicesByRoute = {}

		/** lazy loaded services (GRPCClients) by route */
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

			if (!jsonDescriptorBuffer) {
				throw new Error(`Proto buffer node with no data found: ${znode}`)
			}

			return jsonDescriptorBuffer
		} catch (error) {
			if (error.name === 'NO_NODE') {
				throw new Error(`Znode ${znode} was deleted - service not available anymore`)
			}
			throw error
		}
	}

	_loadInternalService(serviceName) {
		if (!(serviceName in internalServices)) {
			throw new Error('Could not find service in internal services')
		}
		const filename = internalServices[serviceName].filename
		const loadOptions = internalServices[serviceName].loadOptions
		return loadServiceFromFile(filename, serviceName, loadOptions)
	}

	async _loadCustomService(serviceName, protoZnode, loadOptions) {
		const jsonDescriptorBuffer = await this._getProtoBuffer(protoZnode)
		return loadServiceFromBuffer(jsonDescriptorBuffer, serviceName, loadOptions)
	}

	/**
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
			throw new Error(`No services found for route ${route}`)
		}

		// Retrieve proto info from one of the duplicated services.
		// TODO: have just one proto service definition in zk:
		// => we need "custom znode" that persist while there are some services for it
		//	without creating orphan nodes over time...
		// => zk containers could achieve that, but there is no support for it yet
		const { serviceName, protoZnode, loadOptions, internal: isInternal } = availableServices[0]

		if (!serviceName) {
			throw new Error(`Malformed service data for route: ${route}, missing service name`)
		}

		const { ServiceStub, packageDefinition } = isInternal
			? this._loadInternalService(serviceName)
			: await this._loadCustomService(serviceName, protoZnode, loadOptions)

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
