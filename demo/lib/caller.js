const ServiceClient = require('../../lib/service-client')

function caller() {
	const sc = new ServiceClient()

	const request = {
		path: '/service_test',
		refetch_proto_file: true,
	}

	try {
		sc.createSession()
		sc.on('connected', () => {
			console.log('main_caller - Connected to the service router')
			sc.callService(request)
		})

		sc.on('error', (err) => {
			process.exitCode = 1
			console.error(err.message)
		})

		sc.on('close', () => {
			sc.cleanup()
			process.exit()
		})

	} catch (error) {
		console.error(`Unexpected error: ${error.message}`)
	}
}


if (require.main === module) {
	caller()
}
