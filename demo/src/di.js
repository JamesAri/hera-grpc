// TODO: DI

const ZooKeeper = require('../../lib/src/zookeeper')
const config = require('./config')

module.exports = {
	zookeeper: new ZooKeeper({ config }),
}
