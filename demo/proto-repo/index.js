const {loadServiceFromFile} = require('../../lib/utils')

const chatConfig = require('./chat/config')
const poiConfig = require('./poi/config')
const fileShareConfig = require('./file-share/config')

module.exports = {
	chatService: loadServiceFromFile(chatConfig.filename, chatConfig.serviceName, chatConfig.loadOptions),
	poiService: loadServiceFromFile(poiConfig.filename, poiConfig.serviceName, poiConfig.loadOptions),
	fileShareService: loadServiceFromFile(fileShareConfig.filename, fileShareConfig.serviceName, fileShareConfig.loadOptions),
}

