const Service = require('../models/Service');
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 100,
	ttl: 60 * 60,
});

const projection = {
	machineName: 1,
};

const prefix = 's-';

function getService(id, cacheCallback) {
	Service.findOne({ _id: id }, projection)
		.then((service) => {
			if (service) {
				cacheCallback(null, service.toObject());
			} else {
				cacheCallback(null, service);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function getManyServices(ids, cacheCallback) {
	Service.find({ _id: { $in: ids } }, projection)
		.then((services) => {
			const servicesById = {};
			services.forEach((service) => {
				servicesById[service._id] = service.toObject();
			});
			cacheCallback(null, ids.map((id) => servicesById[id]));
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function getMany(ids, cb) {
	const uniqueIds = ids.map((id) => prefix + id);
	if (!uniqueIds.length) {
		cb(null, []);
	} else if (uniqueIds.length === 1) {
		memoryCache.wrap(
			uniqueIds[0],
			(cacheCallback) => {
				getService(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(null, [result]);
			}
		);
	} else {
		memoryCache.wrap(
			...uniqueIds,
			(cacheCallback) => {
				getManyServices(ids, cacheCallback);
			},
			(err, result) => {
				if (err) {
					cb(err, result);
				} else if (uniqueIds.length < 2) {
					cb(null, [result]);
				} else {
					cb(null, result);
				}
			}
		);
	}
}

module.exports = {
	getMany,
};
