function json(call, callback) {
	const req = call.request

	const data = JSON.parse(req.data.toString('utf-8'))
	console.log('Received request:', data)

	const res = {
		data: Buffer.from(JSON.stringify({ hello: 'Response' }))
	}

	callback(null, res)
}

module.exports = {
	json,
}
