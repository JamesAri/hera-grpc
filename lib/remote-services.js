const debug = require('debug')('remote-services')
const GRPCClient = require('./grpc-client')

const { loadServiceFromBuffer } = require('./utils')

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

	/**
	 * @param {string} route
	 * @returns {GRPCClient}
	 */
	async getService(route) {
		debug(`Looking for service with route ${route}`)

		// 1) First check if we have some service already loaded under this route
		if (this.loadedServices[route]) {
			debug(`Using already loaded service with route ${route}`)
			return this.loadedServices[route]
		}

		// 2) If not, check if we have services for that route
		const services = this.servicesByRoute[route]

		if (!services) {
			debug(`No services found for route ${route}`)
			return null
		}

		// TODO: make LB better
		// TODO: if some service throws here, we could try another one
		const randomService = services[Math.floor(Math.random() * services.length)]

		const { serviceName, znode, loadOptions } = randomService.routes[route]

		if (!serviceName || !znode) {
			debug(`Malformed service data - route: ${route}, serviceName: ${serviceName}, proto znode: ${znode}`)
			return null
		}

		const jsonDescriptorBuffer = await this._getProtoBuffer(znode)

		if (!jsonDescriptorBuffer) {
			debug(`Proto buffer node with no data found: ${znode}`)
			return null
		}

		const { ServiceStub, packageDefinition } = loadServiceFromBuffer(jsonDescriptorBuffer, serviceName, loadOptions)

		this.loadedServices[route] = new GRPCClient({
			host: randomService.host,
			port: randomService.port,
			serviceName,
			ServiceStub,
			packageDefinition
		})

		await this._addRemoveServiceWatch(route, znode)

		debug(`New ${serviceName} service with route ${route} added to loaded services`)
		return this.loadedServices[route]
	}
}
