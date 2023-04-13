const WrapperAnalysis = require('../assessment/wrapperAnalysis.model').default;
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 100,
	ttl: 60 * 60,
});

const projection = {
	_id: 1,
	bonus: 1,
	difficulty: 1,
	marks: 1,
};

const prefix = 'wa-';

function getWrapperAnalysis(id, cacheCallback) {
	WrapperAnalysis.findById(id, projection)
		.then((wrapperAnalysis) => {
			if (wrapperAnalysis) {
				if (!wrapperAnalysis.bonus) wrapperAnalysis.bonus = {}; //bug bonus is not fetched from db!!
				// console.log(
				// 	'wrapperAnalysis fetched from cache',
				// 	wrapperAnalysis,
				// 	wrapperAnalysis.bonus
				// );
				cacheCallback(null, wrapperAnalysis.toObject());
			} else {
				cacheCallback(null, wrapperAnalysis);
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
		function (cacheCallback) {
			getWrapperAnalysis(id, cacheCallback);
		},
		cb
	);
}

module.exports = {
	get,
};
