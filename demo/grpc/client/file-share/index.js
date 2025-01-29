const ShareFileService = require('./file-share')
const GRPCClient = require('../../../../lib/grpc-client')

const {fileShareServiceLoader} = require('../../../../proto-repo')

function main() {
	const client = new GRPCClient(fileShareServiceLoader)
	client.connect('localhost', 50051)
	const sfs = new ShareFileService(client)
	sfs.sendFile(__dirname + '/index.js')
}

if (require.main === module) {
	main()
}
