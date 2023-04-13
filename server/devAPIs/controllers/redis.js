const cache = require('../../cache/cache-manager')({
	max: 100,
	ttl: 60 * 60,
});

const key = 'first-date';
const value = new Date();
const getRedisDate = (req, res) => {
	cache.wrap(
		key,
		(cb) => {
			cb(null, null);
		},
		(a, b) => {
			const beforeSave = {
				date: new Date(),
			};
			const afterSave = JSON.stringify(beforeSave);
			const afterFetch = JSON.parse(afterSave);
			res.send({
				a,
				type: typeof b,
				b,
				parsedB: new Date(b),
				jsonParsed: JSON.parse(`{"b":"${b}"}`),
				beforeSave,
				afterSave,
				afterFetch,
				typeBefore: beforeSave.date instanceof Date,
				typeAfterFetch: afterFetch.date instanceof Date,
			});
		}
	);
};

const setRedisDate = (req, res) => {
	cache.set(key, value, (a, b) => {
		res.send({ a, b });
	});
};

module.exports = { getRedisDate, setRedisDate };
