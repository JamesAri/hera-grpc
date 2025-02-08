const fs = require('fs')
const path = require('path')

function downloadFile(call, callback) {
	let fileName = call.metadata.get('x-file-name')
	if (!fileName.length) {
		callback(null, {
			success: false,
			message: 'File name not provided'
		})
		return
	}
	fileName = path.join('downloads/',fileName[0])

	fs.mkdirSync(path.dirname(fileName), { recursive: true })
	const file = fs.createWriteStream(fileName)

	file.on('finish', function() {
		console.log('File downloaded')
	})

	file.on('error', function(err) {
		callback(null, {
			success: false,
			message: 'Error downloading file:' + err
		})
	})

	file.on('open', function() {
		call.on('data', function(data) {
			file.write(data.chunk)
		})

		call.on('end', function() {
			file.end()
			callback(null, {
				success: true,
				message: 'File successfully downloaded'
			})
		})
	})
}

module.exports = {
	downloadFile
}
