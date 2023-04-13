const AssessmentWrapper = require('../assessment/assessmentWrapper.model')
	.default;
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 1000,
	ttl: 24 * 60 * 60,
});

const projection = {
	analysis: 1,
	type: 1,
	'phases.phase': 1,
	'phases.name': 1,
	'phases.availableFrom': 1,
	name: 1,
	sequel: 1,
	prequel: 1,
	availableFrom: 1,
	showInReports: 1,
};

const prefix = 'at-';

function getAssessmentWrapper(id, cacheCallback) {
	AssessmentWrapper.findById(id, projection)
		.populate([
			{ path: 'sequel', select: 'analysis type phases.phase phases.name name' },
			{ path: 'prequel', select: 'analysis type phases.phase phases.name name' },
		])
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

function getManyAssessmentWrapper(ids, cacheCallback) {
	AssessmentWrapper.find({ _id: { $in: ids } }, projection)
		.populate([
			{ path: 'sequel', select: 'analysis type phases.phase phases.name name' },
			{ path: 'prequel', select: 'analysis type phases.phase phases.name name' },
		])
		.then((assessmentWrappers) => {
			const assessmentWrappersById = {};
			assessmentWrappers.forEach((assessmentWrapper) => {
				assessmentWrappersById[
					assessmentWrapper._id
				] = assessmentWrapper.toObject();
			});
			cacheCallback(
				null,
				ids.map((id) => assessmentWrappersById[id])
			);
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
			getAssessmentWrapper(id, cacheCallback);
		},
		cb
	);
}

function getMany(ids, cb) {
	const uniqueIds = ids.map((id) => prefix + id);
	if (!uniqueIds.length) {
		cb(null, []);
	} else if (uniqueIds.length === 1) {
		// uniqueIds.forEach((k) => {
		// 	memoryCache.del(k);
		// });
		memoryCache.wrap(
			uniqueIds[0],
			(cacheCallback) => {
				getAssessmentWrapper(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(null, [result]);
			}
		);
	} else {
		// uniqueIds.forEach((k) => {
		// 	memoryCache.del(k);
		// });
		memoryCache.wrap(
			...uniqueIds,
			(cacheCallback) => {
				getManyAssessmentWrapper(ids, cacheCallback);
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
	get,
	getMany,
};
