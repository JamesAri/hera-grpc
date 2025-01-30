const ServiceRouter = require('../../lib/service-router')

const sr = new ServiceRouter({
	host: 'localhost',
	port: 50051,
})

sr.on('error', (err) => {
	console.error(err.message)
	process.exitCode = 1
})

sr.listen()
