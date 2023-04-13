/**
 * Get the assessments of a perticulat UserGroup
 */
const { forEach, includes, map, size } = require('lodash');
const AssessmentWrapper = require('../assessment/assessmentWrapper.model')
	.default;
const cacheManager = require('./cache-manager');

const cache = cacheManager({
	max: 5000,
	ttl: 24 * 60 * 60,
});
const prefix = 'gra-';

const clearGroupCache = (groupId) => {
	cache.del(`${prefix}${groupId}`, () => {});
};
const mergeResults = (results) => {
	const merged = [];
	forEach(results, (result) =>
		forEach(result, (r) => !includes(merged, r) && merged.push(r))
	);
	return merged;
};
const getAssessmentsOfGroups = (rawGroupIds, cb) => {
	const groupIds = [];
	forEach(rawGroupIds, (id) => {
		if (!includes(groupIds, id)) {
			groupIds.push(id);
		}
	});
	const groupSize = size(groupIds);
	if (groupSize === 0) {
		cb(null, []);
	} else {
		cache.mget(
			...map(groupIds, (groupId) => `${prefix}${groupId}`),
			(error, rawResults) => {
				const results = rawResults;
				const cachedResults = [];
				const nonCachedGroupIds = [];
				forEach(results, (result, index) => {
					if (result) {
						forEach(result, (assessmentWrapper) => {
							cachedResults.push(assessmentWrapper);
						});
					} else {
						nonCachedGroupIds.push(groupIds[index]);
					}
				});
				if (size(nonCachedGroupIds) > 0) {
					AssessmentWrapper.find({
						'permissions.item': { $in: nonCachedGroupIds },
						'permissions.itemType': 'UserGroup',
					})
						.select('permissions')
						.exec((searchError, assessmentWrappers) => {
							if (searchError) {
								cb(searchError);
							} else {
								const assessmentIdsByGroup = {};
								forEach(assessmentWrappers, (assessmentWrapper) => {
									forEach(assessmentWrapper.permissions, (permission) => {
										if (
											permission.itemType === 'UserGroup' &&
											includes(nonCachedGroupIds, permission.item.toString())
										) {
											const groupId = permission.item;
											if (!assessmentIdsByGroup[groupId]) {
												assessmentIdsByGroup[groupId] = [];
											}
											// only add an assessment in a group once
											if (
												!includes(assessmentIdsByGroup[groupId], assessmentWrapper._id)
											) {
												assessmentIdsByGroup[groupId].push(assessmentWrapper._id);
											}
										}
									});
								});
								const dbResults = [];
								const valuesToSave = [];
								forEach(assessmentIdsByGroup, (value, key) => {
									valuesToSave.push(`${prefix}${key}`);
									valuesToSave.push(value);
									dbResults.push(value);
								});

								cb(null, mergeResults([...cachedResults, ...dbResults]));

								cache.mset(...valuesToSave);
							}
						});
				} else {
					cb(null, mergeResults(results));
				}
			}
		);
	}
};

module.exports = { clearGroupCache, getAssessmentsOfGroups };
