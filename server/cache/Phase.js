const Phase = require('../phase/phase.model').default;
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 500,
	ttl: 5 * 60,
	store: 'memory',
});

const projection = {
	deviceLimit: 1,
	name: 1,
	_id: 1,
	topicMocks: 1,
	sectionalMocks: 1,
	fullMocks: 1,
	liveTests: 1,
	startDate: 1,
	endDate: 1,
	topics: 1,
	course: 1,
	series: 1,
	users: 1,
	isPrivate: 1,
	hasCoursePlan: 1,
	inferCoursePlan: 1,
	externalScheduleLink: 1,
	subjects: 1,
	config: 1,
};

const prefix = 'ph-';

function getPhase(id, cacheCallback) {
	Phase.findOne({ _id: id }, projection)
		.then((phase) => {
			if (phase) {
				cacheCallback(null, phase.toObject());
			} else {
				cacheCallback(null, phase);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function getManyPhases(ids, cacheCallback) {
	Phase.find({ _id: { $in: ids } }, projection)
		.then((phases) => {
			const phasesById = {};
			phases.forEach((phase) => {
				phasesById[phase._id] = phase.toObject();
			});
			const result = ids.map((id) => phasesById[id]);
			cacheCallback(null, result);
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
				getPhase(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(err, [result]);
			}
		);
	} else {
		memoryCache.wrap(
			...uniqueIds,
			(cacheCallback) => {
				getManyPhases(ids, cacheCallback);
			},
			cb
		);
	}
}

function clearFromCache(id, cb) {
	memoryCache.del(`${prefix}${id}`, () => {
		if (cb) cb();
	});
}

module.exports = {
	getMany,
	clearFromCache,
};
