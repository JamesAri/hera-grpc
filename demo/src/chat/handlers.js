const MESSAGE_TYPES = require('./message-types')

class ChatService {
	constructor() {
		this._removeConnection = this._removeConnection.bind(this)
		this._multicast = this._multicast.bind(this)
		this._broadcast = this._broadcast.bind(this)
		this._endConnection = this._endConnection.bind(this)
		this.connectChat = this.connectChat.bind(this)

		this.activeConnections = new Map()
	}

	_removeConnection(clientId, stream) {
		console.log(`[-] Removing connection with client ID ${clientId}`)
		if (clientId) {
			this.activeConnections.delete(clientId)
		}
		if (stream) {
			for (const [clientId2, conn] of this.activeConnections) {
				if (conn.stream === stream) {
					this.activeConnections.delete(clientId2)
					if (clientId) {
						console.error(`[!] Removed connection with client ID ${clientId2} that shared stream with client ID ${clientId}`)
					}
					continue
				}
			}
		}
	}

	_multicast(message, fromClientId) {
		for (const [clientId, conn] of this.activeConnections) {
			if (clientId === fromClientId) {
				continue
			}
			conn.stream.write(message)
		}
	}

	_broadcast(message) {
		for (const conn of this.activeConnections.values()) {
			conn.stream.write(message)
		}
	}

	_endConnection(stream, message) {
		console.log(message)
		stream.write({ type: MESSAGE_TYPES.CHAT, content: message })
		stream.end()
	}

	_getConnection(clientId, stream) {
		const conn = this.activeConnections.get(clientId)
		if (!conn) {
			this._endConnection(stream, 'Connection not found')
			throw new Error('Connection not found')
		}

		if (conn.stream !== stream) {
			this._removeConnection(clientId, stream)
			throw new Error(`Connection with client ID ${clientId} has a different stream, removing malformed connections`)
		}

		return conn
	}

	_getUsername(clientId, stream) {
		return this._getConnection(clientId, stream).username
	}

	connectChat(stream) {
		const headers = stream.metadata.getMap()

		if (!headers['x-client-id']) {
			this._endConnection(stream, '[-] Client id not provided, disconnecting')
			return
		}

		const clientId = headers['x-client-id']

		console.log(`[.] New client with id ${clientId} trying to connect`)

		stream.on('data', (message) => {
			switch (message.type) {
			case MESSAGE_TYPES.AUTH:
				if (this.activeConnections.has(clientId)) {
					this._endConnection(stream, '[-] Client with the same id already authenticated, disconnecting')
					return
				}

				if (!message.userName) {
					this._endConnection(stream, '[-] User didn\'t provide a username, disconnecting')
					return
				}

				if (this.activeConnections.values().some(({username}) => username === message.userName)) {
					this._endConnection(stream, `[-] Username "${message.userName}" already taken, disconnecting`)
					return
				}

				this.activeConnections.set(clientId, { username: message.userName, stream })
				this._broadcast({ type: MESSAGE_TYPES.CHAT, content: `${message.userName} joined the chat` })

				console.log(`[+] User "${message.userName}" authenticated`)
				break
			case MESSAGE_TYPES.CHAT:
				const username = this._getUsername(clientId, stream)
				this._multicast({ type: MESSAGE_TYPES.CHAT, content: message.content, userName: username }, clientId)
				console.log(`[>] ${username}: ${message.content}`)
				break
			default:
				this._endConnection(stream, `[!] Unknown message type: ${message.type}`)

			}
		})

		stream.once('end', () => {
			const username = this._getUsername(clientId, stream)
			this._removeConnection(clientId, stream)
			this._broadcast({ type: MESSAGE_TYPES.CHAT, content: `${username} left the chat` })
			console.log(`[-] User "${username}" disconnected`)
		})

		stream.on('cancelled', () => {
			// handle differently than end?
		})

		stream.on('error', (error) => {
			console.log('Error from client:', error.message)
		})
	}
}

// hack
const chatService = new ChatService()

function connectChat(stream) {
	try {
		chatService.connectChat(stream)
	} catch (e) {
		console.error('[-] Error:', e.message)
	}
}

module.exports = {
	connectChat,
}
