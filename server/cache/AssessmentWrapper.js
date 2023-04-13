const { cloneDeep } = require('lodash');
const AssessmentWrapper = require('../assessment/assessmentWrapper.model')
	.default;
const ServiceCache = require('./Service');
const cacheManager = require('./cache-manager');

const cache = cacheManager({
	max: 100,
	ttl: 60 * 60,
});

const projection = {
	_id: 1,
	core: 1,
	name: 1,
	availableFrom: 1,
	availableTill: 1,
	cost: 1,
	visibleForServices: 1,
	phases: 1,
	permissions: 1,
	analysis: 1,
	type: 1,
	graded: 1,
};

const prefix = 'aw-';

function getAssessmentWrapper(id, cacheCallback) {
	AssessmentWrapper.findById(id, projection)
		.then((assessmentWrapper) => {
			if (assessmentWrapper) {
				cacheCallback(null, assessmentWrapper.toObject());
			} else {
				cacheCallback(null, assessmentWrapper);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function get(id, cb) {
	const uniqueId = prefix + id;
	cache.wrap(
		uniqueId,
		(cacheCallback) => {
			getAssessmentWrapper(id, cacheCallback);
		},
		cb
	);
}

function getWithVisibleForServices(id, cb) {
	get(id, (error, assessmentWrapper) => {
		if (error) {
			cb(error, null);
		} else if (assessmentWrapper === undefined || !assessmentWrapper) {
			cb(error, assessmentWrapper);
		} else {
			ServiceCache.getMany(
				assessmentWrapper.visibleForServices,
				(err, services) => {
					if (err) {
						cb(err, null);
					} else {
						const servicesById = {};
						services.forEach((service) => {
							servicesById[service._id] = service;
						});
						const wrapperClone = cloneDeep(assessmentWrapper);
						wrapperClone.visibleForServices = wrapperClone.visibleForServices.map(
							(service) => servicesById[service]
						);
						cb(err, wrapperClone);
					}
				}
			);
		}
	});
}

const clear = (assessmentWrapperId, callback) => {
	let cb = callback;
	if (!callback) {
		cb = () => {};
	}
	cache.del(`${prefix}${assessmentWrapperId}`, cb);
};

module.exports = {
	clear,
	get,
	getWithVisibleForServices,
};
