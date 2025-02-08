module.exports = (client) => new Promise((resolve, reject) => {
	const data = { hello: 'Request' }
	const req = {
		data: Buffer.from(JSON.stringify(data))
	}
	client.service.json(req, (error, res) => {
		if (error) {
			console.error('Got error:', error)
			client.close()
			reject(error)
			return
		}
		const response = JSON.parse(res.data.toString('utf-8'))
		client.close()
		resolve(response)
	})
})
