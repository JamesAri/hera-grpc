const ServiceRouter = require('../../lib/service-router')
const config = require('./config')

const sr = new ServiceRouter({
	host: config.grpcServer.host,
	port: config.grpcServer.port,
	grpcServer: config.grpcServer
})

sr.on('error', (err) => {
	console.error(err.message)
	process.exitCode = 1
})

sr.listen()
