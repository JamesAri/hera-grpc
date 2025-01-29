const ServiceClient = require('../../lib/service-client')

function main_caller() {
	const sc = new ServiceClient()

	const request = {
		path: '/service_test',
		refetch_proto_file: true,
	}

	sc.on('close', () => {
		sc.cleanup()
	})

	try {
		sc.connect()
		sc.on('connected', () => {
			console.log('main_caller - Connected to the service router')
			sc.callService(request)
		})

	} catch (error) {
		console.error(error)
	}
}


if (require.main === module) {
	main_caller()
}
