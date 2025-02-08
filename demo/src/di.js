// TODO: replace with Dependency Injection

const ZooKeeper = require('../../lib/src/zookeeper')
const config = require('./config')

module.exports = {
	zookeeper: new ZooKeeper({ config }),
}
