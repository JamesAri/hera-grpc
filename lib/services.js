const Service = require('./service')
const fs = require('fs')
const path = require('path')
const os = require('os')

module.exports = class Services {
	constructor({zookeeper}) {
		this.servicesByRoute = {}
		this.loadedServices = {}

		this.protoBase = fs.mkdtemp(path.join(os.tmpdir(), 'protoBase-'))
	}

	update(allServices) {
		this.servicesByRoute = allServices
	}

	_downloadProto(serviceInfo) {
		const protoFiles = []

		for (const protoFile of serviceInfo.proto) {
			const buffer = await zk.getProtoFile(protoFile.znode)
			protoFiles.push({
				name: protoFile.name,
				buffer: buffer,
				main: protoFile.main,
			})
		}

		if (!protoFiles) {
			debug(new Error(`Proto file(s) not found for service: ${serviceInfo}`))
			return null
		}

		const dir = fs.mkdtemp(path.join(this.protoBase, 'proto-'))

		for (const protoFile of protoFiles) {
			protoFile.filePath = path.join(dir, `${protoFile.name}`)
		}

		const rootProto = protoFiles.find(protoFile => protoFile.main)

		if (!rootProto) {
			debug(new Error(`Main proto file not found for service: ${serviceInfo}`))
			return null
		}

		for (const protoFile of protoFiles) {
			fs.writeFileSync(protoFile.filePath, protoFile.buffer)
		}

		return {dir, rootProtoFilePath: rootProto.filePath}
	}

	getService(route) {
		// First check if we have some service already loaded under this route
		const loadedService = this.loadedServices[route]

		if (loadedService) {
			return loadedService
		}

		// If not, check if we have services for the route
		const services = this.servicesByRoute[route]

		if (!services) {
			return null
		}

		// TODO: make LB better
		const serviceInfo = services[Math.floor(Math.random() * services.length)]
		const protoPath = this._downloadProto(serviceInfo)
		const service = new Service(serviceInfo, protoPath)
		this.loadedServices[route] = service

		return service
	}

	_updateProto() {
		// const protoFiles = []

		// for (const protoFile of rndService.proto) {
		// 	const buffer = await zk.getProtoFile(protoFile.znode)
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
