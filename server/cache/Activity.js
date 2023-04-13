const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 5000,
	ttl: 60 * 60,
});

const prefix = 'act-';

function getWithoutDb(id, cb) {
	const uniqueId = prefix + id;
	const activity = memoryCache.get(uniqueId);
	cb(null, activity);
}

function set(id, activity, cb) {
	const uniqueId = prefix + activity;
	memoryCache.set(uniqueId, activity);
	cb(null, true);
}

module.exports = {
	getWithoutDb,
	set,
};
