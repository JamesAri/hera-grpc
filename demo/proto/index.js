const { loadServiceFromFile } = require('../../lib/utils')

const loadService = (serviceConfig) => {
	return loadServiceFromFile(serviceConfig.filename, serviceConfig.serviceName, serviceConfig.loadOptions)
}

module.exports = {
	chatService: loadService(require('./chat/config')),
	poiService: loadService(require('./poi/config')),
	fileShareService: loadService(require('./file-share/config')),
}
