const Chat = require('./chat')

// mock repos
const GRPCClient = require('../../../../lib/grpc-client')
const {chatServiceLoader} = require('../../../proto-repo')

function main() {
	const client = new GRPCClient(chatServiceLoader)
	client.connect('localhost', 50051)

	const chat = new Chat(client)
	chat.start()
}

if (require.main === module) {
	main()
}
