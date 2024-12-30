const runPoiDemo = require('./poi')
const GRPCClient = require('../../../lib/client')

const {poiServiceLoader} = require('../../../proto-repo')

function main() {
	const client = new GRPCClient(poiServiceLoader)
	client.connect('localhost', 50051)
	runPoiDemo(client)
}

if (require.main === module) {
	main()
}
