const ServiceRouter = require('../../lib/service-router')

const sr = new ServiceRouter({
	host: 'localhost',
	port: 50051,
})

sr.listen()
