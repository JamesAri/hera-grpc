const EventEmitter = require('node:events').EventEmitter
const util = require('node:util')

const debug = require('debug')('zookeeper')
const debugEmit = require('debug')('zookeeper:emitting')
const zk = require('node-zookeeper-client')

const { deserializeLoadOptions, serializeLoadOptions } = require('./utils')

/**
 * Wrapper around the zookeeper client. It provides a simple interface
 * to interact with zookeeper and manage the connection.
 *
 * It also provides a simple interface to register services and proto files
 * and watch for changes in the /services znode.
 */
module.exports = class ZooKeeper extends EventEmitter {
	#client

	constructor(connection) {
		super()

		this.watchServices = this.watchServices.bind(this)

		this.connection = connection
		this.#client = null

		const { host, pathname } = new URL(connection)
		this.urn = host + pathname
		this._closed = true
	}

	/**
	 * Creates the root zk nodes which will be used for the service discovery and
	 * proto buffer file distribution.
	 *
	 * @param {function} next - callback function to be called after the nodes are created
	 */
	async createRootNodes(next) {
		try {
			await this.#client.mkdirpPromisified(`/services`)
			await this.#client.mkdirpPromisified(`/proto`)
			next()
		} catch (error) {
			throw new Error(`Failed to create root nodes: ${error}`)
		}
	}

	/**
	 * Creates new client and connects to the zookeeper server.
	 */
	connect() {
		debug(`connecting to ${this.urn}`)

		this.#client = zk.createClient(this.urn, { retries: 5, sessionTimeout: 15000 })

		this.#client.createPromisified = util.promisify(this.#client.create)
		this.#client.getDataPromisified = util.promisify(this.#client.getData)
		this.#client.getChildrenPromisified = util.promisify(this.#client.getChildren)
		this.#client.removeRecursivePromisified = util.promisify(this.#client.removeRecursive)
		this.#client.existsPromisified = util.promisify(this.#client.exists)
		this.#client.mkdirpPromisified = util.promisify(this.#client.mkdirp)
		this.#client.removePromisified = util.promisify(this.#client.remove)

		this.#client.on('connected', () => {
			this.createRootNodes(() => {
				this.emit('connected')
			})
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

	/**
	 * Register the service to zookeeper. The service info is stored in a
	 * znode.
	 *
	 * @param {object} service
	 * @returns {string} registered service znode
	 */
	async _registerService(service) {
		const znode = await this.create(
			'/services/service',
			service,
			zk.CreateMode.EPHEMERAL_SEQUENTIAL,
		)
		debug(`Node created: ${this.urn}${znode}`)
		return znode
	}

	/**
	 * Register the proto file as buffer to zookeeper. The proto file will
	 * be stored in a znode.
	 *
	 * @param {Buffer} buffer
	 * @returns {string} registered proto file znode
	 */
	async _registerProtoFile(buffer) {
		if (buffer.length >= 1024 * 1024) {
			// default zk limit
			throw new Error('Proto file buffer is too large (1MB max)')
		}

		const znode = await this.create('/proto/buffer', buffer, zk.CreateMode.EPHEMERAL_SEQUENTIAL)
		debug(`Node created: ${this.urn}${znode}`)
		return znode
	}

	/**
	 * Register the service to zookeeper. The service info is stored in a
	 * znode.
	 *
	 * @param {{host: string, port: number}} serviceInfo
	 * @param {{
	 * 	routes: string[],
	 * 	buffer: Buffer,
	 * 	serviceName: string,
	 * 	loadOptions: object,
	 * 	isInternal: boolean,
	 * }[]} protoFiles
	 * @returns {string} registered service znode
	 */
	async register(serviceInfo, protoFiles) {
		// TODO: tx (https://www.npmjs.com/package/node-zookeeper-client#transaction-transaction)
		debug(`Registering to zookeeper at ${this.urn}`)

		const { host, port } = serviceInfo

		const service = {
			host: host,
			port: port,
			routes: {},
		}

		// register all proto buffer files for this service
		for (const pf of protoFiles) {
			const { serviceName, routes, buffer, isInternal, loadOptions: lo } = pf

			debug(`Registering proto file | ${serviceName} | ${routes} | internal: ${isInternal}`)

			if (isInternal) {
				for (const route of routes) {
					service.routes[route] = {
						serviceName,
						internal: true,
					}
				}
				continue
			}

			const protoBufferZnode = await this._registerProtoFile(buffer)

			const loadOptions = serializeLoadOptions(lo)

			if (loadOptions) {
				// proto file(s) loaded in json descriptor buffer, we won't touch the fs
				delete loadOptions.includeDirs
			}

			// TODO: Handle this better:
			// Here we have multiple routes registered for the same service, thus they share proto files and load options.
			// We should save this just once and use references (without leaving orphaned znodes over time)
			for (const route of routes) {
				service.routes[route] = {
					serviceName,
					protoZnode: protoBufferZnode,
					...(loadOptions && { loadOptions }),
				}
			}
		}

		// register the service
		const serviceZnode = await this._registerService(service)
		return serviceZnode
	}

	/**
	 * Watch the /services znode for changes. This will trigger
	 * the services event with the updated list of services.
	 *
	 * The services are mapped by route as Map<route, services_for_given_route[]>.
	 *
	 * @returns {Promise<void>}
	 */
	async watchServices() {
		if (this._closed) {
			return
		}
		try {
			const children = await this.getChildren('/services', this.watchServices)
			const servicesByRoute = {}
			const processChildren = children.map(
				(child) =>
					new Promise((resolve) => {
						this.#client.getData(`/services/${child}`, (err, data) => {
							if (err) {
								if (err.name !== 'NO_NODE') {
									debug(`watchServices.getData /services/${child}: ${err}`)
								}
								// TODO: log error since we don't reject here
								resolve()
								return
							}
							try {
								const service = JSON.parse(data)

								const { host, port, routes } = service

								for (const route in routes) {
									const protoBufferInfo = routes[route]

									protoBufferInfo.loadOptions = deserializeLoadOptions(protoBufferInfo.loadOptions)

									if (!servicesByRoute[route]) {
										servicesByRoute[route] = []
									}

									servicesByRoute[route].push({
										host,
										port,
										serviceZnode: `/services/${child}`,
										protoZnode: protoBufferInfo.protoZnode,
										serviceName: protoBufferInfo.serviceName,
										loadOptions: protoBufferInfo.loadOptions,
										internal: protoBufferInfo.internal,
									})
								}
							} catch (error) {
								debug(`watchServices JSON.parse: ${error} data: ${data}`)
							}
							resolve()
						})
					}),
			)
			await Promise.all(processChildren)
			debugEmit('services')
			this.emit('services', servicesByRoute)
		} catch (error) {
			debug(`watchServices.getChildren /services: ${error}`)
		}
	}

	/**
	 * Create a znode with the specified path and data. The data is
	 * serialized to a buffer if it is not already a buffer.
	 */
	async create() {
		if (!Buffer.isBuffer(arguments[1])) {
			arguments[1] = Buffer.from(JSON.stringify(arguments[1]))
		}
		return this.#client.createPromisified(...arguments)
	}

	async remove() {
		return this.#client.removePromisified(...arguments)
	}

	async getData() {
		return this.#client.getDataPromisified(...arguments)
	}

	async exists() {
		return this.#client.existsPromisified(...arguments)
	}

	async getChildren() {
		return this.#client.getChildrenPromisified(...arguments)
	}

	async removeRecursive() {
		return this.#client.removeRecursivePromisified(...arguments)
	}
}
