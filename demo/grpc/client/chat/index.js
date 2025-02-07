const Chat = require('./chat')

// mock repos
const GRPCClient = require('../../../../lib/grpc-client')
const {chatService} = require('../../../proto-repo')

function main() {
	const client = new GRPCClient(chatService)
	client.connect('localhost', 50051)

	const chat = new Chat(client)
	chat.start()
}

if (require.main === module) {
	main()
}
