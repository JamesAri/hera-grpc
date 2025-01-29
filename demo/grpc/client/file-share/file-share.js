const fs = require('fs')
const path = require('path')
const grpc = require('@grpc/grpc-js')
const { Transform } = require('node:stream')

const transformToGrpcMessage = new Transform({
	objectMode: true,
	transform(chunk, _encoding, callback) {
		callback(null, {chunk})
	}
})

module.exports = class ShareFileService {
	constructor(client) {
		this.client = client
	}

	sendFile(fileName) {
		const metadata = new grpc.Metadata()
		metadata.add('x-file-name', path.basename(fileName))
		const call = this.client.service.downloadFile(metadata, (error, res) => {
			if (error) {
				console.log('Received server error: ', error)
				return
			}
			console.log({res})
		})
		const stream = fs.createReadStream(fileName)
		stream.pipe(transformToGrpcMessage).pipe(call)
	}
}


