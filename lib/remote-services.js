const debug = require('debug')('remote-services')
const Service = require('./service')

const {loadServiceFromBuffer} = require('./utils')

module.exports = class RemoteServices {
	constructor({zookeeper}) {
		// Services by route as returned (and mapped) from zk
		this.servicesByRoute = {}

		// (lazy) loaded ServiceStubs and packageDefinitions
		this.loadedServices = {}

		// this.protoBase = fs.mkdtemp(path.join(os.tmpdir(), 'protoBase-'))
		this.zookeeper = zookeeper
	}

	update(servicesByRoute) {
		this.servicesByRoute = servicesByRoute
	}

	async _addServiceRemoveWatch(route, znode) {

		debug(`Adding remove watch for route ${route} at znode ${znode}`)

		try {
			await this.zookeeper.getData(znode, (_event) => {
				delete this.loadedServices[route]
				debug(`loadedServices: ${this.loadedServices}`)
			})
		} catch (error) {
			if (this.loadedServices[route]) {
				this.loadedServices[route].close()
			}
			delete this.loadedServices[route]
			const err = new Error(`Error adding watch for route ${route} at znode ${znode}: ${error.message}`)
			debug(err.message)
			throw err
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

	async getService(route) {
		debug(`Getting service for route ${route}`)

		// First check if we have some service already loaded under this route
		const loadedService = this.loadedServices[route]

		if (loadedService) {
			debug(`Using already loaded service for route ${route}`)
			return loadedService
		}

		// If not, check if we have services for the route
		const services = this.servicesByRoute[route]

		if (!services) {
			debug(`No services found for route ${route}`)
			return null
		}

		// TODO: make LB better
		const randomService = services[Math.floor(Math.random() * services.length)]

		const {serviceName, znode, loadOptions} = randomService.routes[route]

		if (!serviceName || !znode) {
			debug(`Malformed service data - route: ${route}, serviceName: ${serviceName}, proto znode: ${znode}`)
			return null
		}

		const jsonDescriptorBuffer = await this._getProtoBuffer(znode)

		if (!jsonDescriptorBuffer) {
			debug(`Proto buffer node with no data found: ${znode}`)
			return null
		}

		const {ServiceStub, packageDefinition} = loadServiceFromBuffer(jsonDescriptorBuffer, serviceName, loadOptions)

		this.loadedServices[route] = new Service(
			randomService.host,
			randomService.port,
			ServiceStub,
			packageDefinition
		)

		await this._addServiceRemoveWatch(route, znode)

		debug(`New service for route ${route} created`)
		return this.loadedServices[route]
	}
}
