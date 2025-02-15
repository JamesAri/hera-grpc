const debug = require('debug')('remote-services')

const GRPCClient = require('./grpc-client')
const { loadServiceFromBuffer, shuffle } = require('./utils')

module.exports = class RemoteServices {
	constructor({ zookeeper }) {
		// Services by route as returned (and mapped to routes) from zk
		this.servicesByRoute = {}

		// (lazy) loaded ServiceStubs and packageDefinitions
		this.loadedServices = {}
		this.zookeeper = zookeeper
	}

	update(servicesByRoute) {
		this.servicesByRoute = servicesByRoute
	}

	async _addRemoveServiceWatch(route, znode) {
		debug(`Adding remove watch for route ${route} at znode ${znode}`)

		const removeService = () => {
			// note: we are not closing the client as it is the user's responsibility,
			// this will just remove the "cached" service we got from zookeeper
			delete this.loadedServices[route]
			debug('loadedServices updated:')
			debug(this.loadedServices)
		}

		try {
			await this.zookeeper.getData(znode, (_event) => {
				debug(`Service znode: ${znode}, event:  ${_event}`)
				removeService()
			})
		} catch (error) {
			removeService()
			throw new Error(`Error adding watch for route ${route} at znode ${znode}: ${error.message}`)
		}
	}

	async _getProtoBuffer(znode) {
		let jsonDescriptorBuffer
		try {
			jsonDescriptorBuffer = await this.zookeeper.getData(znode)
		} catch (error) {
			if (error.name === 'NO_NODE') {
				debug(`Znode ${znode} was deleted - service not available anymore`)
			}
			return null
		}
		return jsonDescriptorBuffer
	}

	getConnectionList(services) {
		return 'ipv4:' + shuffle(services.map((service) => `${service.host}:${service.port}`)).join(',')
	}

	/**
	 * @param {string} route
	 * @returns {GRPCClient}
	 */
	async getService(route) {
		debug(`Looking for service with route ${route}`)

		const services = this.servicesByRoute[route]

		if (!services) {
			debug(`No services found for route ${route}`)
			return null
		}

		// https://github.com/grpc/grpc/blob/master/doc/naming.md
		const connection = this.getConnectionList(services)

		if (this.loadedServices[route]) {
			debug(`Using already loaded service with route ${route}`)
			this.loadedServices[route].setConnection(connection)
			return this.loadedServices[route]
		}

		// TODO: if some service throws here, we could try another one

		// retrieve proto info from one of the duplicated services
		const { serviceName, znode, loadOptions } = services[0].routes[route]

		if (!serviceName || !znode) {
			debug(
				`Malformed service data - route: ${route}, serviceName: ${serviceName}, proto znode: ${znode}`,
			)
			return null
		}

		const jsonDescriptorBuffer = await this._getProtoBuffer(znode)

		if (!jsonDescriptorBuffer) {
			debug(`Proto buffer node with no data found: ${znode}`)
			return null
		}

		const { ServiceStub, packageDefinition } = loadServiceFromBuffer(
			jsonDescriptorBuffer,
			serviceName,
			loadOptions,
		)

		this.loadedServices[route] = new GRPCClient({
			connection,
			serviceName,
			ServiceStub,
			packageDefinition,
		})

		await this._addRemoveServiceWatch(route, znode)

		debug(`New ${serviceName} service with route ${route} added to loaded services`)
		return this.loadedServices[route]
	}
}
