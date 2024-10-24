const grpc = require('@grpc/grpc-js')
const readline = require('readline')
const { getServiceStubConstructor } = require('../../lib/utils')
const chatServiceConfig = require('../shared/services/chat-service/service-config')
const MESSAGE_TYPES = require('../shared/services/chat-service/const/message-types')

const ChatServiceStub = getServiceStubConstructor(chatServiceConfig)

const chatService = new ChatServiceStub('localhost:50051', grpc.credentials.createInsecure())

const userName = process.argv[2] || ''

function authenticate(call) {
	console.log(`Authenticating as ${userName}`)
	call.write({ type: MESSAGE_TYPES.AUTH, userName: userName })
}

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
})


// Function to start the chat
function startChat(stream) {
	rl.setPrompt(`${userName}: `)
	rl.prompt()

	rl.on('line', function(message) {
		rl.prompt() // Prompt again for the next message
		stream.write({ type: MESSAGE_TYPES.CHAT, content: message })
	})

	rl.once('close', function() {
		rl.setPrompt('')
		stream.end()
		process.exit(0)
	})

	const originalConsoleError = console.error
	const originalConsoleLog = console.log
	console.log = function(...args) {
		rl.output.write('\x1B[2K\r') // Clear the current input line
		originalConsoleLog.apply(console, args) // Call the original console.log
		rl._refreshLine() // Repaint the prompt and current input
	}
	console.error = function(...args) {
		rl.output.write('\x1B[2K\r')
		originalConsoleError.apply(console, args)
		rl._refreshLine()
	}
}

function runChatRoom() {
	const stream = chatService.connectChat()

	authenticate(stream)

	startChat(stream)

	stream.on('data', function(message) {
		if (message.type === MESSAGE_TYPES.CHAT) {
			if (!message.content) return

			if (message.userName) {
				console.log(`${message.userName}: ${message.content}`)
			} else {
				console.log(message.content)
			}
			return
		}
		console.log('Error, unknown message type received:', message.type)
	})

	stream.on('end', function() {
		console.log('Server terminated connection')
		rl.close()
	})

	stream.on('error', function(_err) {
		console.error('Lost connection to server')
		process.exit(1)
	})
}

/**
 * Run all of the demos in order
 */
function main() {
	runChatRoom()
}

if (require.main === module) {
	main()
}

exports.runChatRoom = runChatRoom
