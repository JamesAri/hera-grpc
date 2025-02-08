const fs = require('fs')
const async = require('async')
const path = require('path')
const _ = require('lodash')

const COORD_FACTOR = 1e7

let service = null

/**
 * List of feature objects at points that have been requested so far.
 */
let featureList = []

fs.readFile(path.join(__dirname, './poi-db-mock.json'), function(err, data) {
	if (err) throw err
	featureList = JSON.parse(data)
})

/**
 * Run the getFeature demo. Calls getFeature with a point known to have a
 * feature and a point known not to have a feature.
 * @param {function} callback Called when this demo is complete
 */
function runGetFeature(callback) {
	const next = _.after(2, callback)
	function featureCallback(error, feature) {
		if (error) {
			callback(error)
			return
		}
		if (feature.name === '') {
			console.log(
				'Found no feature at ' +
					feature.location.latitude / COORD_FACTOR +
					', ' +
					feature.location.longitude / COORD_FACTOR,
			)
		} else {
			console.log(
				'Found feature called "' +
					feature.name +
					'" at ' +
					feature.location.latitude / COORD_FACTOR +
					', ' +
					feature.location.longitude / COORD_FACTOR,
			)
		}
		next()
	}
	const point1 = {
		latitude: 409146138,
		longitude: -746188906,
	}
	const point2 = {
		latitude: 0,
		longitude: 0,
	}
	service.getFeature(point1, featureCallback)
	service.getFeature(point2, featureCallback)
}

/**
 * Run the listFeatures demo. Calls listFeatures with a rectangle containing all
 * of the features in the pre-generated database. Prints each response as it
 * comes in.
 * @param {function} callback Called when this demo is complete
 */
function runListFeatures(callback) {
	const rectangle = {
		lo: {
			latitude: 400000000,
			longitude: -750000000,
		},
		hi: {
			latitude: 420000000,
			longitude: -730000000,
		},
	}
	console.log('Looking for features between 40, -75 and 42, -73')
	const call = service.listFeatures(rectangle)
	call.on('data', function (feature) {
		console.log(
			'Found feature called "' +
				feature.name +
				'" at ' +
				feature.location.latitude / COORD_FACTOR +
				', ' +
				feature.location.longitude / COORD_FACTOR,
		)
	})
	call.on('end', callback)
}

/**
 * Run the recordRoute demo. Sends several randomly chosen points from the
 * pre-generated feature database with a variable delay in between. Prints the
 * statistics when they are sent from the server.
 * @param {function} callback Called when this demo is complete
 */
function runRecordRoute(callback) {
	const numPoints = 10
	const call = service.recordRoute(function (error, stats) {
		if (error) {
			callback(error)
			return
		}
		console.log('Finished trip with', stats.point_count, 'points')
		console.log('Passed', stats.feature_count, 'features')
		console.log('Travelled', stats.distance, 'meters')
		console.log('It took', stats.elapsed_time, 'seconds')
		callback()
	})
	/**
		 * Constructs a function that asynchronously sends the given point and then
		 * delays sending its callback
		 * @param {number} lat The latitude to send
		 * @param {number} lng The longitude to send
		 * @return {function(function)} The function that sends the point
		 */
	function pointSender(lat, lng) {
		/**
			 * Sends the point, then calls the callback after a delay
			 * @param {function} callback Called when complete
			 */
		return function (callback) {
			console.log('Visiting point ' + lat / COORD_FACTOR + ', ' + lng / COORD_FACTOR)
			call.write({
				latitude: lat,
				longitude: lng,
			})
			_.delay(callback, _.random(500, 1500))
		}
	}
	const pointSenders = []
	for (let i = 0; i < numPoints; i++) {
		const randPoint = featureList[_.random(0, featureList.length - 1)]
		pointSenders[i] = pointSender(randPoint.location.latitude, randPoint.location.longitude)
	}
	async.series(pointSenders, function () {
		call.end()
	})
}

/**
 * Run the routeChat demo. Send some chat messages, and print any chat messages
 * that are sent from the server.
 * @param {function} callback Called when the demo is complete
 */
function runRouteChat(callback) {
	const call = service.routeChat()
	call.on('data', function (note) {
		console.log('Got message "' + note.message + '" at ' + note.location.latitude + ', ' + note.location.longitude)
	})

	call.on('end', callback)

	const notes = [
		{
			location: {
				latitude: 0,
				longitude: 0,
			},
			message: 'First message',
		},
		{
			location: {
				latitude: 0,
				longitude: 1,
			},
			message: 'Second message',
		},
		{
			location: {
				latitude: 1,
				longitude: 0,
			},
			message: 'Third message',
		},
		{
			location: {
				latitude: 0,
				longitude: 0,
			},
			message: 'Fourth message',
		},
	]
	for (let i = 0; i < notes.length; i++) {
		const note = notes[i]
		console.log('Sending message "' + note.message + '" at ' + note.location.latitude + ', ' + note.location.longitude)
		call.write(note)
	}
	call.end()
}

/**
 * Run all of the demos in order
 */
async function run(client) {
	service = client.service // hack
	await async.series([runGetFeature, runListFeatures, runRecordRoute, runRouteChat])
}


module.exports = run
