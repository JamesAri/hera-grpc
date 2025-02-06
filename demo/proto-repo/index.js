const {loadServiceFromFile} = require('../../lib/utils')

module.exports = {
	chatServiceLoader: () => loadServiceFromFile(require('./chat/config')),
	poiServiceLoader: () => loadServiceFromFile(require('./poi/config')),
	fileShareServiceLoader: () => loadServiceFromFile(require('./file-share/config')),
}

