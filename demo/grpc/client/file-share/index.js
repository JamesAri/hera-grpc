const ShareFileService = require('./file-share')
const GRPCClient = require('../../../../lib/grpc-client')

const {fileShareService} = require('../../../proto-repo')

function main() {
	const client = new GRPCClient(fileShareService)
	client.connect('localhost', 50051)
	const sfs = new ShareFileService(client)
	sfs.sendFile(__dirname + '/index.js')
}

if (require.main === module) {
	main()
}
