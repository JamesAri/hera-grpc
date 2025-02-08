const _ = require('lodash')
const path = require('path')
const fs = require('fs')

const COORD_FACTOR = 1e7

/**
 * List of feature objects at points that have been requested so far.
 */
let featureList = []

// Mock db
fs.readFile(path.join(__dirname, './poi-db-mock.json'), function (err, data) {
	if (err) throw err
	featureList = JSON.parse(data)
})

/**
 * Get a feature object at the given point, or creates one if it does not exist.
 * @param {point} point The point to check
 * @return {feature} The feature object at the point. Note that an empty name
 *     indicates no feature
 */
function checkFeature(point) {
	console.log('Checking feature for point:', point)
	let feature
	// Check if there is already a feature object for the given point
	for (let i = 0; i < featureList.length; i++) {
		feature = featureList[i]
		if (feature.location.latitude === point.latitude && feature.location.longitude === point.longitude) {
			return feature
		}
	}
	const name = ''
	feature = {
		name: name,
		location: point,
	}
	return feature
}

/**
 * getFeature request handler. Gets a request with a point, and responds with a
 * feature object indicating whether there is a feature at that point.
 * @param {EventEmitter} call Call object for the handler to process
 * @param {function(Error, feature)} callback Response callback
 */
function getFeature(call, callback) {
	callback(null, checkFeature(call.request))
}

/**
 * listFeatures request handler. Gets a request with two points, and responds
 * with a stream of all features in the bounding box defined by those points.
 * @param {Writable} call Writable stream for responses with an additional
 *     request property for the request value.
 */
function listFeatures(call) {
	console.log('Listing features')
	const lo = call.request.lo
	const hi = call.request.hi
	const left = _.min([lo.longitude, hi.longitude])
	const right = _.max([lo.longitude, hi.longitude])
	const top = _.max([lo.latitude, hi.latitude])
	const bottom = _.min([lo.latitude, hi.latitude])
	// For each feature, check if it is in the given bounding box
	_.each(featureList, function (feature) {
		if (feature.name === '') {
			return
		}
		if (
			feature.location.longitude >= left &&
			feature.location.longitude <= right &&
			feature.location.latitude >= bottom &&
			feature.location.latitude <= top
		) {
			call.write(feature)
		}
	})
	call.end()
}

/**
 * Calculate the distance between two points using the "haversine" formula.
 * The formula is based on http://mathforum.org/library/drmath/view/51879.html.
 * @param start The starting point
 * @param end The end point
 * @return The distance between the points in meters
 */
function getDistance(start, end) {
	console.log('Calculating distance between points:', start, end)
	function toRadians(num) {
		return (num * Math.PI) / 180
	}
	const R = 6371000 // earth radius in metres
	const lat1 = toRadians(start.latitude / COORD_FACTOR)
	const lat2 = toRadians(end.latitude / COORD_FACTOR)
	const lon1 = toRadians(start.longitude / COORD_FACTOR)
	const lon2 = toRadians(end.longitude / COORD_FACTOR)

	const deltalat = lat2 - lat1
	const deltalon = lon2 - lon1
	const a =
		Math.sin(deltalat / 2) * Math.sin(deltalat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltalon / 2) * Math.sin(deltalon / 2)
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
	return R * c
}

/**
 * recordRoute handler. Gets a stream of points, and responds with statistics
 * about the "trip": number of points, number of known features visited, total
 * distance traveled, and total time spent.
 * @param {Readable} call The request point stream.
 * @param {function(Error, routeSummary)} callback The callback to pass the
 *     response to
 */
function recordRoute(call, callback) {
	let pointCount = 0
	let featureCount = 0
	let distance = 0
	let previous = null
	// Start a timer
	const startTime = process.hrtime()
	call.on('data', function (point) {
		pointCount += 1
		if (checkFeature(point).name !== '') {
			featureCount += 1
		}
		/* For each point after the first, add the incremental distance from the
		 * previous point to the total distance value */
		if (previous != null) {
			distance += getDistance(previous, point)
		}
		previous = point
	})
	call.on('end', function () {
		console.log('Route recording complete')
		callback(null, {
			point_count: pointCount,
			feature_count: featureCount,
			// Cast the distance to an integer
			distance: distance | 0,
			// End the timer
			elapsed_time: process.hrtime(startTime)[0],
		})
	})
}

const routeNotes = {}

/**
 * Turn the point into a dictionary key.
 * @param {point} point The point to use
 * @return {string} The key for an object
 */
function pointKey(point) {
	return point.latitude + ' ' + point.longitude
}

/**
 * routeChat handler. Receives a stream of message/location pairs, and responds
 * with a stream of all previous messages at each of those locations.
 * @param {Duplex} call The stream for incoming and outgoing messages
 */
function routeChat(call) {
	console.log('Routing chat')
	call.on('data', function (note) {
		const key = pointKey(note.location)
		/* For each note sent, respond with all previous notes that correspond to
		 * the same point */
		// eslint-disable-next-line no-prototype-builtins
		if (routeNotes.hasOwnProperty(key)) {
			_.each(routeNotes[key], function (note) {
				call.write(note)
			})
		} else {
			routeNotes[key] = []
		}
		// Then add the new note to the list
		routeNotes[key].push(JSON.parse(JSON.stringify(note)))
	})
	call.on('end', function () {
		console.log('Chat routing complete')
		call.end()
	})
}

module.exports = {
	getFeature,
	listFeatures,
	recordRoute,
	routeChat,
}
