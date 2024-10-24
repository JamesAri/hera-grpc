// Business logic - gRPC service implementations

const MESSAGE_TYPES = require('../../../shared/services/chat-service/const/message-types')

const users = []

const getUser = (stream) => users.find(user => user.stream === stream)

const removeUser = (stream) => {
	const user = getUser(stream)
	users.splice(users.indexOf(user), 1)
	return user
}

const multicast = (message, fromUser) => {
	for (const user of users) {
		if (user === fromUser) {
			continue
		}
		user.stream.write(message)
	}
}

const broadcast = (message) => {
	for (const user of users) {
		user.stream.write(message)
	}
}

function connectChat(stream) {
	console.log('New client trying to connect')

	// console.log({stream})

	stream.on('data', function (message) {
		switch (message.type) {
		case MESSAGE_TYPES.AUTH:
			const userName = message.userName
			if (!userName) {
				console.log('[-] User didn\'t provide a username, disconnecting')
				stream.write({type: MESSAGE_TYPES.CHAT, content: 'Please provide a username'})
				stream.end()
				return
			}
			if (users.some(user => user.name === userName)) {
				console.log(`[-] Username "${userName}" already taken, disconnecting`)
				stream.write({type: MESSAGE_TYPES.CHAT, content: 'Username already taken, please choose another username'})
				stream.end()
				return
			}
			console.log(`[+] User "${userName}" authenticated`)
			broadcast({type: MESSAGE_TYPES.CHAT, content: `${userName} joined the chat`})
			users.push({name: userName, stream})
			break
		case MESSAGE_TYPES.CHAT:
			const user = getUser(stream)
			console.log(`[>] ${user.name}: ${message.content}`)
			multicast({type: MESSAGE_TYPES.CHAT, content: message.content, userName: user.name}, user)
			break
		default:
			console.log('[!] Unknown message type:', message.type)
		}
	})

	stream.on('end', function () {
		const user = removeUser(stream)
		console.log(`[-] User "${user.name}" disconnected`)
		broadcast({type: MESSAGE_TYPES.CHAT, content: `${user.name} left the chat`})
	})
}

module.exports = {
	connectChat,
}
