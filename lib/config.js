module.exports = {
	timeouts: {
		clientDeadline: 60, // in seconds
	},
	retry: {
		maxAttempts: 10,
		delay: 1000, // in ms
	}
}
