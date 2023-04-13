const { cloneDeep } = require('lodash');
const AssessmentCore = require('../assessment/assessmentCore.model').default;
const QuestionCache = require('./Question');
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 100,
	ttl: 60 * 60,
});

const projection = {
	_id: 1,
	instructions: 1,
	sectionInstructions: 1,
	customInstructions: 1,
	syllabus: 1,
	duration: 1,
	'sections.name': 1,
	'sections.questionGroups': 1,
	'sections.duration': 1,
	'sections.questions.question': 1,
	'sections.questions.correctMark': 1,
	'sections.questions.incorrectMark': 1,
	'sections.questions.timeLimit': 1,
	analysis: 1,
	markingScheme: 1,
	config: 1,
	// section._id
};

const prefix = 'ac-';

function getAssessmentCore(id, cacheCallback) {
	AssessmentCore.findById(id, projection)
		.then((assessmentCore) => {
			if (assessmentCore) {
				cacheCallback(null, assessmentCore.toObject());
			} else {
				cacheCallback(null, assessmentCore);
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
			getAssessmentCore(id, cacheCallback);
		},
		cb
	);
}

function getWithQuestions(id, cb) {
	get(id, (err, assessmentCore) => {
		if (err) {
			cb(err, null);
		} else if (assessmentCore === undefined) {
			cb(err, undefined);
		} else {
			const ids = [];
			assessmentCore.sections.forEach((section) => {
				section.questions.forEach((question) => {
					ids.push(question.question);
				});
			});
			QuestionCache.getManyWithContent(ids, (err, questions) => {
				if (err) {
					cb(err, null);
				} else {
					const questionsById = {};
					questions.forEach((question) => {
						questionsById[question._id] = question;
					});
					const assessmentCoreClone = cloneDeep(assessmentCore);
					assessmentCoreClone.sections.forEach((section) => {
						section.questions.forEach((question) => {
							question.question = questionsById[question.question];
						});
					});
					cb(err, assessmentCoreClone);
				}
			});
		}
	});
}

function getWithSolution(id, cb) {
	get(id, (err, assessmentCore) => {
		if (err) {
			cb(err, null);
		} else if (assessmentCore === undefined) {
			cb(err, undefined);
		} else {
			const ids = [];
			assessmentCore.sections.forEach((section) => {
				section.questions.forEach((question) => {
					ids.push(question.question);
				});
			});
			QuestionCache.getManyWithoutContent(ids, (err, questions) => {
				if (err) {
					cb(err, null);
				} else {
					const questionsById = {};
					questions.forEach((question) => {
						questionsById[question._id] = question;
					});
					const assessmentCoreClone = cloneDeep(assessmentCore);
					assessmentCoreClone.sections.forEach((section) => {
						section.questions.forEach((question) => {
							question.question = questionsById[question.question];
						});
					});
					cb(err, assessmentCoreClone);
				}
			});
		}
	});
}

function getManyAssessmentCores(ids, cacheCallback) {
	AssessmentCore.find({ _id: { $in: ids } }, projection)
		.then((assessmentCores) => {
			const assessmentCoresById = {};
			assessmentCores.forEach((assessmentCore) => {
				assessmentCoresById[assessmentCore._id] = assessmentCore.toObject();
			});
			const result = ids.map((id) => assessmentCoresById[id]);
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
				getAssessmentCore(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(err, [result]);
			}
		);
	} else {
		memoryCache.wrap(
			...uniqueIds,
			(cacheCallback) => {
				getManyAssessmentCores(ids, cacheCallback);
			},
			cb
		);
	}
}

module.exports = {
	get,
	getWithQuestions,
	getWithSolution,
	getMany,
};
