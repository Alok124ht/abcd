const UserXp = require('../user/userxp.model');
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 5000,
	ttl: 24 * 60 * 60,
});

const projection = {
	net: 1,
};

const prefix = 'ux-';

function getUserXp(id, cacheCallback) {
	UserXp.findOne({ user: id }, projection)
		.then((userxp) => {
			if (userxp) {
				cacheCallback(null, userxp.net);
			} else {
				cacheCallback(null, userxp); //userxp doesnot exists
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
		function(cacheCallback) {
			getUserXp(id, cacheCallback);
		},
		cb
	);
}

function update(id, xp, cb) {
	const uniqueId = prefix + id;
	memoryCache.set(uniqueId, xp, cb);
}

function inc(id, delXp, cb) {
	const uniqueId = prefix + id;
	memoryCache.get(uniqueId, function(err, xp) {
		if (!err && xp) {
			memoryCache.set(uniqueId, xp + delXp, cb);
		}
	});
}

module.exports = {
	get,
	update,
	inc,
};
