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
		this.service = client.service
	}

	sendFile(fileName) {
		const metadata = new grpc.Metadata()
		metadata.add('x-file-name', path.basename(fileName))
		const call = this.service.downloadFile(metadata, (error, res) => {
			if (error) {
				console.log('Received server error: ', error)
				return
			}
			console.log({res})
			this.service.close()
		})
		const stream = fs.createReadStream(fileName)
		stream.on('end', () => {
			console.log('createReadStream - END event')
			this.client.close()
		})
		stream.pipe(transformToGrpcMessage).pipe(call)
	}
}


