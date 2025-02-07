const runPoiDemo = require('./poi')
const GRPCClient = require('../../../../lib/grpc-client')

const {poiService} = require('../../../proto-repo')

function main() {
	const client = new GRPCClient(poiService)
	client.connect('localhost', 50051)
	runPoiDemo(client.service)
}

if (require.main === module) {
	main()
}
