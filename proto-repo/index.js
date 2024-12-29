const {getPackageDefinition, getServiceStub} = require('./utils')

const chatConfig = require('./chat/config')
const poiConfig = require('./poi/config')

const loadService = (config) => {
	const packageDefinition = getPackageDefinition(config)
	const serviceStub = getServiceStub(packageDefinition, config.serviceName)
	return {serviceStub, packageDefinition}
}

const chatServiceLoader = () => {
	return loadService(chatConfig)
}

const poiServiceLoader = () => {
	return loadService(poiConfig)
}

module.exports = {
	chatServiceLoader,
	poiServiceLoader
}

