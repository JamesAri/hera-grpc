const debug = require('debug')('remote-services')
const Service = require('./service')

const {loadServiceFromBuffer} = require('./utils')

module.exports = class RemoteServices {
	constructor({zookeeper}) {
		// Services by route as returned (and mapped) from zk
		this.servicesByRoute = {}

		// ServiceStubs and packageDefinitions
		this.loadedServices = {}

		// this.protoBase = fs.mkdtemp(path.join(os.tmpdir(), 'protoBase-'))
		this.zookeeper = zookeeper
	}

	update(servicesByRoute) {
		this.servicesByRoute = servicesByRoute
	}

	async getService(route) {
		// First check if we have some service already loaded under this route
		const loadedService = this.loadedServices[route]

		if (loadedService) {
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
			debug(`Service or znode not found for route ${route}`)
			return null
		}

		const jsonDescriptorBuffer = await this.zookeeper.getData(znode)

		if (!jsonDescriptorBuffer) {
			debug(`Proto buffer not found for route ${route}`)
			return null
		}

		const {ServiceStub, packageDefinition} = loadServiceFromBuffer(jsonDescriptorBuffer, serviceName, loadOptions)
		this.loadedServices[route] = new Service(randomService.host, randomService.port, ServiceStub, packageDefinition)
		return this.loadedServices[route]
	}

	_updateProto() {
		// const protoFiles = []

		// for (const protoFile of rndService.proto) {
		// 	const buffer = await zk.getData(protoFile.znode)
		// 	protoFiles.push({
		// 		name: protoFile.name,
		// 		buffer: buffer,
		// 	})
		// }

		// if (!protoFiles) {
		// 	this._error(new Error('Proto files not found'))
		// 	return
		// }

		// const dir = fs.mkdtemp(path.join(this.protoBase, 'proto-'))

		// // TODO: invalidate sometime?
		// for (const protoFile of protoFiles) {
		// 	const tmpFilePath = path.join(dir, `${protoFile.name}`)
		// 	fs.writeFileSync(tmpFilePath, protoFile.buffer)
		// }

		// // update services structure
	}
}
