const {loadServiceFactory} = require('../lib/utils')

module.exports = {
	chatServiceLoader: loadServiceFactory(require('./chat/config')),
	poiServiceLoader: loadServiceFactory(require('./poi/config')),
	fileShareServiceLoader: loadServiceFactory(require('./file-share/config')),
}

