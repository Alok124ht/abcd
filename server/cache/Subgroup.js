const { cloneDeep } = require('lodash');
const SubGroupModel = require('../group/subGroup.model').default;
const PhaseCache = require('./Phase');
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 1000,
	ttl: 24 * 60 * 60,
});

const projection = {
	_id: 1,
	phases: 1,
	// isPrivate: 1,
};

const prefix = 'subg-';

function getSubgroup(id, cacheCallback) {
	SubGroupModel.findById(id, projection)
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
	memoryCache.wrap(
		uniqueId,
		(cacheCallback) => {
			getSubgroup(id, cacheCallback);
		},
		cb
	);
}

function getWithPhases(id, cb) {
	get(id, (error, subgroup) => {
		if (error) {
			cb(error, null);
		} else if (subgroup === undefined) {
			cb(error, undefined);
		} else {
			const phaseIds = subgroup.phases.map((p) => p.phase);
			PhaseCache.getMany(phaseIds, (err, phases) => {
				if (err) {
					cb(err, null);
				} else {
					const phasesById = {};
					phases.forEach((phase) => {
						phasesById[phase._id] = phase;
					});
					const subgroupClone = cloneDeep(subgroup);
					subgroupClone.phases = subgroupClone.phases.map((phase) => ({
						...phase,
						phase: phasesById[phase.phase],
					}));
					cb(err, subgroupClone);
				}
			});
		}
	});
}

module.exports = {
	get,
	getWithPhases,
};
