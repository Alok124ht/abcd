/**
 * mapping for actionType begins here
 */
const actions = [{ key: 'V', label: 'view' }, { key: 'C', label: 'click' }];
const actionsByKey = {};
const keysByAction = {};
const actionKeys = actions.forEach(({ key, label }) => {
	actionsByKey[key] = label;
	keysByAction[label] = key;
	return key;
});
/**
 * mapping for actionType ends here
 */

/**
 * mapping for actorModel starts here
 */
const actorModels = [
	{ key: 'U', label: 'User' },
	{ key: 'V', label: 'VisitorUser' },
];
const actorModelsByKey = {};
const keysByActorModels = {};
const actorModelKeys = actorModels.map(({ key, label }) => {
	actorModelsByKey[key] = label;
	keysByActorModels[label] = key;
	return key;
});

/**
 * mapping for actorModel ends here
 */

/**
 * mapping for subjectModel starts here
 */

const subjectModels = [{ key: '4C', label: 'P4Course' }];

const subjectModelsByKey = {};
const keysBySubjectModel = {};
const subjectModelKeys = subjectModels.map(({ key, label }) => {
	subjectModelsByKey[key] = label;
	keysBySubjectModel[label] = key;
	return key;
});

module.exports = {
	actionKeys,
	actorModelKeys,
	subjectModelKeys,
	actionsByKey,
	keysByAction,
	actorModelsByKey,
	keysByActorModels,
	subjectModelsByKey,
	keysBySubjectModel,
};
