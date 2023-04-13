const CoreAnalysis = require('../assessment/coreAnalysis.model').default;
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 100,
	ttl: 60 * 60,
});

const projection = {
	_id: 1,
	'sections.questions.correctAttempts': 1,
	'sections.questions.sumTime': 1,
	'sections.questions.totalAttempts': 1,
};

const prefix = 'ca-';

function getCoreAnalysis(id, cacheCallback) {
	CoreAnalysis.findById(id, projection)
		.then((coreAnalysis) => {
			if (coreAnalysis) {
				cacheCallback(null, coreAnalysis.toObject());
			} else {
				cacheCallback(null, coreAnalysis);
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
			getCoreAnalysis(id, cacheCallback);
		},
		cb
	);
}

module.exports = {
	get,
};
