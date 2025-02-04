const zk = require('node-zookeeper-client')
const debug = require('debug')('zookeeper')
const EventEmitter = require('node:events').EventEmitter
const util = require('node:util')
const logger = require('./logger')('zookeeper')

module.exports = class ZooKeeper extends EventEmitter {
	#client

	constructor({ config }) {
		super()

		this.watchServices = this.watchServices.bind(this)

		this.config = config
		this.#client = null

		const { host, pathname } = new URL(this.config.zookeeper)
		this.urn = host + pathname
		this._closed = false
	}

	connect() {
		debug(`connecting to ${this.urn}`)

		this.#client = zk.createClient(this.urn, { retries: 5 })

		this.#client.createPromisified = util.promisify(this.#client.create)
		this.#client.getDataPromisified = util.promisify(this.#client.getData)
		this.#client.getChildrenPromisified = util.promisify(this.#client.getChildren)
		this.#client.removeRecursivePromisified = util.promisify(this.#client.removeRecursive)
		this.#client.existsPromisified = util.promisify(this.#client.exists)
		this.#client.mkdirpPromisified = util.promisify(this.#client.mkdirp)
		this.#client.removePromisified = util.promisify(this.#client.remove)

		this.#client.on('connected', () => {
			// TODO: handle
			this.emit('connected')
			setTimeout(() => {
				this.emit('ready')
			}, 5000)
		})

		this.#client.on('disconnected', () => {
			this.emit('disconnected')
		})

		this.#client.on('expired', () => {
			this.disconnect()
			this.connect()
		})

		this.#client.on('state', (state) => {
			debug(new Date(), 'zk changed state to:', state)
		})

		this.#client.connect()
	}

	disconnect() {
		this._closed = true
		this.#client.close()
		this.#client.removeAllListeners()
	}

	async _registerService(service) {
		const znode = await this.create('/services/service', service, zk.CreateMode.EPHEMERAL_SEQUENTIAL)
		debug(new Date(), `zookeeper: node created: ${this.urn}${znode}`)
		return znode
	}

	async _registerProtoFile(protoFile) {
		const { name, buffer } = protoFile

		if (buffer.length >= 1024 * 1024) {
			throw new Error(`zookeeper: proto file ${name} is too large (1MB max)`)
		}

		const znode = await this.create('/proto/file', buffer, zk.CreateMode.EPHEMERAL_SEQUENTIAL)

		debug(new Date(), `zookeeper: node created: ${this.urn}${znode}`)
		return znode
	}

	parseLoadOptions(loadOptions) {
		const options = { ...loadOptions }
		if (options.longs) {
			options.longs = options.longs === 'Number' ? Number : String
		}
		if (options.bytes) {
			options.bytes = options.bytes === 'Array' ? Array : String
		}
		if (options.enums) {
			// Only valid value is `String` (the global type)
			options.enums = options.enums === 'String' ? String : null // TODO: test this
		}
		return options
	}

	formatLoadOptions(loadOptions) {
		const options = { ...loadOptions }
		if (options.longs) {
			options.longs = options.longs === Number ? 'Number' : 'String'
		}
		if (options.bytes) {
			options.bytes = options.bytes === Array ? 'Array' : 'String'
		}
		if (options.enums) {
			// Only valid value is `String` (the global type)
			options.enums = options.enums === String ? 'String' : null // TODO: test this
		}
		return options
	}

	async register(serviceInfo, protoFiles, next) {
		// TODO: transaction
		debug(new Date(), `registering to zookeeper at ${this.urn}`)

		const { serviceName, appName, version, host, port, route, loadOptions } = serviceInfo

		try {
			if (!serviceName) {
				throw new Error('zookeeper error: serviceName is required')
			}
			if (!appName) {
				throw new Error('zookeeper error: appName is required')
			}
			if (!version) {
				throw new Error('zookeeper error: version is required')
			}
			if (!host) {
				throw new Error('zookeeper error: host is required')
			}
			if (!port) {
				throw new Error('zookeeper error: port is required')
			}
			if (!route) {
				throw new Error('zookeeper error: route is required')
			}
			if (!loadOptions) {
				throw new Error('zookeeper error: load options are required')
			}
			if (!protoFiles) {
				throw new Error('zookeeper error: protoFiles are required')
			}
			if (loadOptions.includeDirs) {
				throw new Error('zookeeper error: includeDirs load option is not supported')
			}

			const service = {
				serviceName: serviceName,
				appName: appName,
				version: version,
				host: host,
				port: port,
				route: route,
				loadOptions: this.formatLoadOptions(loadOptions),
				proto: [],
			}

			for (const protoFile of protoFiles) {
				if (!protoFile.name) {
					throw new Error('zookeeper error: proto file name is required')
				}
				if (!protoFile.buffer) {
					throw new Error('zookeeper error: proto file buffer is required')
				}

				const protoZnode = await this._registerProtoFile(protoFile)

				service.proto.push({
					znode: protoZnode,
					name: protoFile.name,
					main: protoFile.main,
				})
			}

			const serviceZnode = await this._registerService(service)
			next(null, serviceZnode)
		} catch (err) {
			next(err)
		}
	}

	async getProtoFile(path, next) {
		let protoFiles = null
		const nodeStat = await this.exists(path)
		if (nodeStat) {
			protoFiles = await this.getData(path)
		}
		if (next) {
			next(null, protoFiles)
		}
		return protoFiles
	}

	// async getServices(next) {
	// 	const services = {}
	// 	const children = await this.getChildren('/services')

	// 	for (const child of children) {
	// 		let data = await this.getData(`/services/${child}`)
	// 		data = JSON.parse(data)
	// 		data.loadOptions = this.parseLoadOptions(data.loadOptions)

	// 		if (!services[data.route]) {
	// 			services[data.route] = []
	// 		}
	// 		services[data.route].push(data)
	// 	}
	// 	if (next) {
	// 		next(null, services)
	// 	}
	// 	return services
	// }

	watchServices() {
		if (this._closed) {
			return
		}
		this.#client.getChildren('/services', this.watchServices, async (error, children) => {
			if (error) {
				logger.error(`watchServices.getChildren /services: ${error}`)
				return
			}
			const services = {}
			const processChildren = children.map(
				(child) =>
					new Promise((resolve) => {
						this.#client.getData(`/services/${child}`, (err, data) => {
							if (err) {
								if (err.name !== 'NO_NODE') {
									logger.error(`watchServices.getData /services/${child}: ${err}`)
								}
								resolve()
								return
							}
							try {
								const service = JSON.parse(data)
								service.loadOptions = this.parseLoadOptions(service.loadOptions)

								if (!services[service.route]) {
									services[service.route] = []
								}
								services[service.route].push(service)
							} catch (err) {
								logger.error(`watchServices JSON.parse: ${err} data: ${data}`)
							}
							resolve()
						})
					}),
			)
			await Promise.all(processChildren)
			this.emit('services', services)
		})
	}

	create() {
		if (!Buffer.isBuffer(arguments[1])) {
			arguments[1] = Buffer.from(JSON.stringify(arguments[1]))
		}
		return this.#client.createPromisified(...arguments)
	}

	remove() {
		return this.#client.removePromisified(...arguments)
	}

	getData() {
		return this.#client.getDataPromisified(...arguments)
	}

	exists() {
		return this.#client.existsPromisified(...arguments)
	}

	getChildren() {
		return this.#client.getChildrenPromisified(...arguments)
	}

	removeRecursive() {
		return this.#client.removeRecursivePromisified(...arguments)
	}
}
