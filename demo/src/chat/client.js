const readline = require('readline')
const crypto = require('crypto')
const grpc = require('@grpc/grpc-js')

const MESSAGE_TYPES = require('./message-types')

module.exports = class Chat {
	constructor(client) {
		this.start = this.start.bind(this)
		this._authenticate = this._authenticate.bind(this)
		this._prepareChatCli = this._prepareChatCli.bind(this)
		this._runChatRoom = this._runChatRoom.bind(this)

		this.username = process.argv[2] || crypto.randomBytes(5).toString('hex')

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		})
		this.client = client
		this.service = client.service
		this.stream = null
	}

	start() {
		const metadata = new grpc.Metadata()
		metadata.add('x-client-id', this.username)
		this.stream = this.service.connectChat(metadata)
		this._authenticate()
		this._prepareChatCli()
		this._runChatRoom()
	}

	_authenticate() {
		console.log(`Authenticating as ${this.username}`)
		this.stream.write({ type: MESSAGE_TYPES.AUTH, userName: this.username })
	}

	_prepareChatCli() {
		this.rl.setPrompt(`${this.username}: `)
		this.rl.prompt()

		this.rl.on('line', (message) => {
			this.rl.prompt() // Prompt again for the next message
			this.stream.write({ type: MESSAGE_TYPES.CHAT, content: message })
		})

		this.rl.once('close', () => {
			this.rl.setPrompt('')
			this.stream.end()
			process.exit(0)
		})

		const originalConsoleLog = console.log
		console.log = (...args) => {
			this.rl.output.write('\x1B[2K\r') // Clear the current input line
			originalConsoleLog.apply(console, args) // Call the original console.log
			this.rl._refreshLine() // Repaint the prompt and current input
		}

		const originalConsoleError = console.error
		console.error = (...args) => {
			this.rl.output.write('\x1B[2K\r')
			originalConsoleError.apply(console, args)
			this.rl._refreshLine()
		}
	}

	_runChatRoom() {
		this.stream.on('data', function(message) {
			if (message.type === MESSAGE_TYPES.CHAT) {
				if (!message.content) return

				if (message.userName) {
					console.log(`${message.userName}: ${message.content}`)
				} else {
					console.log(message.content)
				}
				return
			}
			console.log('Error: unknown message type received:', message.type)
		})

		this.stream.on('end', () => {
			console.log('Server terminated connection')
			this.rl.close()
		})

		this.stream.on('status', (status) => {
			console.log(status) // not for streams :) - Status of the call when it has completed.
		})

		this.stream.on('error', (err /** ServiceError */) => {
			console.error('Lost connection to server:', err.message)
			process.exit(1)
		})
	}
}

