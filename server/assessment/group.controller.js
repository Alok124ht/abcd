/**
 * Management of assessment published to user groups
 */
const { getGroupsOfUser } = require('../cache/UserGroups');
const {
	clearGroupCache,
	getAssessmentsOfGroups,
} = require('../cache/GroupAssessments');
const AssessmentWrapper = require('./assessmentWrapper.model').default;
const APIError = require('../helpers/APIError');

const addGroupToAssessmentWrapper = (req, res, next) => {
	const {
		assessmentWrapperId,
		availableFrom,
		expiresOn,
		groupId,
		name,
		slang,
	} = req.body;
	AssessmentWrapper.findOne({ _id: assessmentWrapperId }).exec(
		(searchError, assessmentWrapper) => {
			if (searchError) {
				next(new APIError('', 500));
			} else if (!assessmentWrapper) {
				next(new APIError('Wrapper not found', 404));
			} else {
				assessmentWrapper.permissions.push({
					item: groupId,
					itemType: 'UserGroup',
					name,
					slang,
					expiresOn,
					availableFrom,
				});
				assessmentWrapper.save((saveError) => {
					clearGroupCache(groupId);
					if (saveError) {
						next(new APIError(saveError, 422));
					} else {
						res.send({ assessmentWrapper });
					}
				});
			}
		}
	);
};
/**
 * TODO: complete removeGroupFromAssessmentWrapper
 */
const removeGroupFromAssessmentWrapper = (req, res, next) => {
	const { groupId, assessmentWrapperId } = req.body;
	AssessmentWrapper.findOne({ _id: assessmentWrapperId }).exec(
		(searchError, assessmentWrapper) => {
			if (searchError) {
				next(new APIError('', 500));
			} else if (!assessmentWrapper) {
				next(new APIError('Wrapper not found', 404));
			} else {
				assessmentWrapper.permission;
			}
		}
	);
};

const getMyAssessments = (req, res) => {
	const { id: userId } = req.payload;
	getGroupsOfUser(userId, (err, groups) => {
		getAssessmentsOfGroups(groups, (assessmentSearchError, assessmentIds) => {
			AssessmentWrapper.find(
				{ _id: { $in: assessmentIds } },
				{
					core: 1,
					name: 1,
					slang: 1,
					type: 1,
					topic: 1,
					section: 1,
					label: 1,
					availableFrom: 1,
					availableTill: 1,
					visibleFrom: 1,
					expiresOn: 1,
					graded: 1,
					cost: 1,
					reward: 1,
					phases: 1, //??
					description: 1,
					comps: 1,
					messages: 1,
					difficulty: 1,
					visibleForServices: 1,
					series: 1,
				}
			)
				.populate([
					{
						path: 'core',
						select:
							'instructions syllabus duration sectionInstructions customSyllabus',
					},
				])
				.exec((searchError, assessments) => {
					res.send({
						err,
						groups,
						assessmentWrappers: assessments,
						success: true,
						assessmentSearchError,
					});
				});
		});
	});
};

module.exports = { addGroupToAssessmentWrapper, getMyAssessments };
