const EventEmitter = require('node:events').EventEmitter
const util = require('node:util')

const debug = require('debug')('zookeeper')
const zk = require('node-zookeeper-client')

const { deserializeLoadOptions, serializeLoadOptions } = require('./utils')

module.exports = class ZooKeeper extends EventEmitter {
	#client

	constructor(config) {
		super()

		this.watchServices = this.watchServices.bind(this)

		this.config = config
		this.#client = null

		const { host, pathname } = new URL(this.config.zookeeper)
		this.urn = host + pathname
		this._closed = true
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
			this.emit('connected')
		})

		this.#client.on('disconnected', () => {
			this.emit('disconnected')
		})

		this.#client.on('expired', () => {
			this.disconnect()
			this.connect()
		})

		this.#client.on('state', (state) => {
			debug('zk changed state to:', state)
		})

		this.#client.connect()
		this._closed = false
	}

	/**
	 * Disconnect from Zookeeper will close the connection, remove all listeners
	 * and not trigger additional watches provided by this class.
	 *
	 * If you decide to manually reconnect, you should setup the watches again.
	 */
	disconnect() {
		if (this.#client) {
			this.#client.close()
			this.#client.removeAllListeners()
		}
		this._closed = true
	}

	async _registerService(service) {
		const znode = await this.create(
			'/services/service',
			service,
			zk.CreateMode.EPHEMERAL_SEQUENTIAL,
		)
		debug(`zookeeper: node created: ${this.urn}${znode}`)
		return znode
	}

	async _registerProtoFile(buffer) {
		if (buffer.length >= 1024 * 1024) {
			throw new Error('zookeeper: proto file buffer is too large (1MB max)')
		}

		const znode = await this.create('/proto/buffer', buffer, zk.CreateMode.EPHEMERAL_SEQUENTIAL)
		debug(`zookeeper: node created: ${this.urn}${znode}`)
		return znode
	}

	async register(serviceInfo, protoFiles, next) {
		// TODO: transaction
		debug(`registering to zookeeper at ${this.urn}`)

		const { host, port } = serviceInfo

		try {
			const service = {
				host: host,
				port: port,
				routes: {},
			}

			for (const pf of protoFiles) {
				const { serviceName, route, buffer, loadOptions } = pf
				debug(`registering proto file for route ${pf.route}`)

				const protoBufferZnode = await this._registerProtoFile(buffer)

				service.routes[route] = {
					serviceName,
					znode: protoBufferZnode,
					...(loadOptions && { loadOptions: serializeLoadOptions(loadOptions) }),
				}
			}

			const serviceZnode = await this._registerService(service)
			next(null, serviceZnode)
		} catch (err) {
			next(err)
		}
	}

	watchServices() {
		if (this._closed) {
			return
		}
		this.#client.getChildren('/services', this.watchServices, async (error, children) => {
			if (error) {
				debug(`watchServices.getChildren /services: ${error}`)
				return
			}
			const servicesByRoute = {}
			const processChildren = children.map(
				(child) =>
					new Promise((resolve) => {
						this.#client.getData(`/services/${child}`, (err, data) => {
							if (err) {
								if (err.name !== 'NO_NODE') {
									debug(`watchServices.getData /services/${child}: ${err}`)
								}
								resolve()
								return
							}
							try {
								const service = JSON.parse(data)

								service.znode = `/services/${child}`

								for (const route in service.routes) {
									service.routes[route].loadOptions = deserializeLoadOptions(
										service.routes[route].loadOptions,
									)

									if (!servicesByRoute[route]) {
										servicesByRoute[route] = []
									}

									servicesByRoute[route].push(service)
								}
							} catch (error) {
								debug(`watchServices JSON.parse: ${error} data: ${data}`)
							}
							resolve()
						})
					}),
			)
			await Promise.all(processChildren)
			this.emit('services', servicesByRoute)
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
