const UserLiveAssessment = require('../user/UserLiveAssessment').default;
const cacheManager = require('./cache-manager');
const logger = require('../../config/winston').default;

const memoryCache = cacheManager({
	max: 5000,
	ttl: 60 * 60,
});

const projection = {
	assessmentWrapperId: 1,
	startTime: 1,
	duration: 1,
	flow: 1,
};

const prefix = 'ula-';

function getUserLiveAssessment(id, cacheCallback) {
	UserLiveAssessment.findOne({ user: id }, projection)
		.then((userLiveAssessment) => {
			if (userLiveAssessment) {
				cacheCallback(null, userLiveAssessment.toObject());
			} else {
				const userLiveAssessment_ = new UserLiveAssessment({
					user: id,
				});
				userLiveAssessment_
					.save()
					.then((savedUserLiveAssessment) => {
						cacheCallback(null, savedUserLiveAssessment.toObject());
					})
					.catch((err) => {
						cacheCallback(err);
					});
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function get(id, cb) {
	const uniqueId = prefix + id;
	memoryCache.wrap(
		uniqueId,
		(cacheCallback) => {
			getUserLiveAssessment(id, cacheCallback);
		},
		cb
	);
}

function set(id, data, cb) {
	const uniqueId = prefix + id;
	memoryCache
		.set(uniqueId, data)
		.then(() => {
			cb(null, true);
		})
		.catch((error) => {
			logger.error(
				`Failed to set UserLiveAssessment userId: ${id}, data:${JSON.stringify(
					data
				)}`
			);
			cb(error, true);
		});
}

module.exports = {
	get,
	set,
};
