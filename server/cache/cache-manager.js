const cacheManager = require('cache-manager');
const redis = require('./redis').default;
const config = require('../../config/config');

const cacheStoreType = process.env.CACHE_STORE_TYPE;

module.exports = (options) =>
	cacheManager.caching({
		store: cacheStoreType === 'redis' ? redis : 'memory',
		...options,
		...(cacheStoreType === 'redis' ? config.redis : {}),
	});
