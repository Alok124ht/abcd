const mongoose = require('mongoose');
const Draft = require('./draft.model');
const AssessmentCore = require('../assessment/assessmentCore.model').default;
const CoreAnalysis = require('../assessment/coreAnalysis.model').default;
const SuperGroupModel = require('../group/superGroup.model').default;
const Question = require('../question/question.model').default;
const Client = require('../client/client.model').default; // no need
const APIError = require('../helpers/APIError');
const { generateInstructions } = require('./instructions');

const { ObjectId } = mongoose.Types;

function list(req, res) {
	const { id: userId, role } = req.payload;
	const { q, skip, limit, superGroup, createdAt, hasQuestionGroups } = req.body;
	// const query = { isArchived: { $ne: true } };
	const query = {};
	if (superGroup) {
		query.supergroup = superGroup;
	}
	if (ObjectId.isValid(q)) {
		query._id = ObjectId(q);
	} else if (typeof q === 'string' && q.trim()) {
		query.name = { $regex: new RegExp(q.trim(), 'i') };
	}
	if (createdAt) {
		query.createdAt = createdAt;
	}
	if (hasQuestionGroups === '1' || hasQuestionGroups === '0') {
		query['sections.questionGroups.0'] = { $exists: hasQuestionGroups === '1' };
	}

	const process = () => {
		Draft.find(query)
			.skip(parseInt(skip, 10))
			.limit(parseInt(limit, 10))
			.sort({ createdAt: -1 })
			.exec()
			.then((drafts) => {
				Draft.countDocuments(query).exec((countError, total) => {
					res.json({ drafts, total: countError ? drafts.length : total });
				});
			});
	};

	if (role === 'moderator') {
		Client.findOne({ moderators: userId }, { _id: 1 }).then((client) => {
			if (client) {
				query.client = client._id;
				process();
			} else {
				res.json({ success: false });
			}
		});
	} else {
		process();
	}
}

const clone = (req, res, next) => {
	const { client } = res.locals;
	const { role } = req.payload;
	const { draft: draftId, name } = req.body;
	const query = { _id: draftId };
	if (role !== 'admin' && role !== 'super') {
		query.client = client._id;
	}
	Draft.findOne(query, (searchError, draft) => {
		if (searchError) {
			next(new APIError('Error searching the draft', 500, true));
		} else if (!draft) {
			next(new APIError('Draft not found', 404, true));
		} else {
			// eslint-disable-next-line no-param-reassign
			draft.isNew = true;
			draft.set('name', name || `Copy of ${draft.name}`);
			draft.set('createdAt', undefined);
			draft.set('updatedAt', undefined);
			// eslint-disable-next-line new-cap
			draft.set('_id', ObjectId());
			draft.save((saveError) => {
				if (saveError) {
					next(new APIError(saveError, 500, true));
				} else {
					res.send({ draft });
				}
			});
		}
	});
};

function save(req, res) {
	const {
		config,
		name,
		supergroup,
		duration,
		sections,
		defaultQuestionTimeLimit,
		correct,
		incorrect,
		correctMultiple,
		incorrectMultiple,
		correctNumerical,
		incorrectNumerical,
		instructionType,
		marking1,
		marking2,
		sectionGroups,
	} = req.body;

	const secs = sections.map((s) => ({
		questionGroups: s.questionGroups,
		name: s.name,
		duration: s.duration,
	}));

	const { id, role } = req.payload;

	if (role === 'moderator') {
		Client.findOne({ moderators: id }, { _id: 1 }).then((client) => {
			if (client) {
				SuperGroupModel.findOne({ _id: supergroup }).then((sg) => {
					if (sg) {
						const draft = new Draft({
							defaultQuestionTimeLimit,
							name,
							supergroup,
							duration,
							sections: secs,
							correct,
							incorrect,
							correctMultiple,
							incorrectMultiple,
							correctNumerical,
							incorrectNumerical,
							instructionType: instructionType || 'NONE',
							markingScheme: {
								multipleCorrect: marking1,
								matchTheColumns: marking2,
							},
							config,
							client: client._id,
							sectionGroups,
						});
						draft.save().then((savedDraft) => {
							res.json({ success: true, draftId: savedDraft._id });
						});
					} else {
						res.json({ success: false });
					}
				});
			} else {
				res.json({ success: false });
			}
		});
	} else {
		SuperGroupModel.findOne({ _id: supergroup }).then((sg) => {
			if (sg) {
				const draft = new Draft({
					defaultQuestionTimeLimit,
					name,
					supergroup,
					duration,
					sections: secs,
					correct,
					incorrect,
					correctMultiple,
					incorrectMultiple,
					correctNumerical,
					incorrectNumerical,
					instructionType: instructionType || 'NONE',
					markingScheme: {
						multipleCorrect: marking1,
						matchTheColumns: marking2,
					},
					config,
					sectionGroups,
				});
				draft.save().then((savedDraft) => {
					res.json({ success: true, draftId: savedDraft._id });
				});
			} else {
				res.json({ success: false });
			}
		});
	}
}

function update(req, res) {
	let { sections } = req.body;
	const { config, customInstructions, id } = req.body;
	sections = JSON.parse(sections);
	Draft.findById(id)
		.exec()
		.then((draft) => {
			let sectionsToRemove = [];
			draft.sections.forEach((section) => {
				const exists = sections.some((sec) => section._id.equals(sec._id));
				if (!exists) {
					sectionsToRemove.push(section._id);
				}
			});
			sections.forEach((sec, currentIndex) => {
				let sectionIndex = -1;
				draft.sections.forEach((section, idx) => {
					if (section._id.equals(sec._id)) sectionIndex = idx;
				});
				if (sectionIndex !== -1) {
					draft.sections[sectionIndex].questionGroups = sec.questionGroups;
					draft.sections[sectionIndex].questions = sec.questions;
					draft.sections[sectionIndex].name = sec.name;
					if (sec.duration) {
						draft.sections[sectionIndex].duration = sec.duration;
					}
				} else {
					// to ensure reverse index
					sectionsToRemove = [currentIndex, ...sectionsToRemove];
				}
			});
			if (sectionsToRemove.length) {
				draft.sections.pull(sectionsToRemove);
			}
			// sectionsToRemove.forEach((sectionIndex, removeIndex) => {
			// 	draft.sections.splice(sectionIndex, 1);
			// });
			const instructions = generateInstructions(draft);
			draft.set('instructions', instructions);
			// draft.set('customInstructions', customInstructions);
			// draft.set('config', config);
			draft.markModified('sections');
			draft.save().then((savedDraft) => {
				res.json({ success: true, savedDraft });
			});
		});
}

function archive(req, res) {
	const {
		payload: { role, id: _id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { id } = req.body;
	if (role === 'moderator') {
		Client.findOne({ moderators: ObjectId(_id) }).then((client) => {
			if (client) {
				Draft.update(
					{ _id: id, client: client._id },
					{ $set: { isArchived: true } }
				).then((m) => {
					if (m.nModified) {
						res.json({ success: true });
					} else {
						res.json({ success: false });
					}
				});
			} else {
				res.json({ success: false });
			}
		});
	} else {
		Draft.update({ _id: id }, { $set: { isArchived: true } }).then(() => {
			res.json({ success: true });
		});
	}
}

function generateSyllabus(draft) {
	const syllabus = {}; // sort syllabus alphabatically!!!
	draft.sections.forEach((section) => {
		section.questions.forEach((question) => {
			if (!syllabus[question.topic]) syllabus[question.topic] = [];
			if (syllabus[question.topic].indexOf(question.sub_topic) === -1) {
				syllabus[question.topic].push(question.sub_topic);
			}
		});
	});

	return Object.keys(syllabus).map((key) => ({
		id: key,
		subTopics: syllabus[key].map((st) => ({ id: st })),
	}));
}

function generateSectionInstructions(draft) {
	const sectionInstructions = [];

	if (draft.instructionType === 'NONE') {
		// do nothing
	} else if (draft.instructionType === '8SCQ8MCQ2L-P') {
		sectionInstructions.push({
			text:
				'First EIGHT questions of each section have four options, out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions.push({
			text:
				'Next EIGHT questions, each of which has four options. ONE OR MORE THAN ONE of these four options is (are) correct option(s). For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions.push({
			text:
				'The last TWO questions of each section has matching lists. The codes for the lists have choices (A), (B), (C) and (D) out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions[0].markingScheme.push({
			text:
				'Full Marks : +3 If only the option corresponding to the correct answer is selected.',
		});

		sectionInstructions[0].markingScheme.push({
			text: 'Zero Marks : 0 If none of the options is selected.',
		});

		sectionInstructions[0].markingScheme.push({
			text: 'Negative Marks : –1 In all other cases',
		});

		sectionInstructions[1].markingScheme.push({
			text: 'Full Marks : +4 If only (all) the correct option(s) is (are) chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Partial Marks : +3 If all the four options are correct but ONLY three options are chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Partial Marks : +2 If three or more options are correct but ONLY two correct options are chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Partial Marks : +1 If two or more options are correct but ONLY one correct option is chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Zero Marks : 0 If none of the options is chosen (i.e. the question is unanswered).',
		});

		sectionInstructions[1].markingScheme.push({
			text: 'Negative Marks : -2 In all other cases.',
		});

		sectionInstructions[2].markingScheme.push({
			text:
				'Full Marks : +3 If ONLY the option corresponding to the correct answer is selected.',
		});

		sectionInstructions[2].markingScheme.push({
			text: 'Zero Marks : 0 If none of the options is selected.',
		});

		sectionInstructions[2].markingScheme.push({
			text: 'Negative Marks : -1 In all other cases.',
		});
	} else if (draft.instructionType === '4SCQ10MCQ4NUM-P') {
		sectionInstructions.push({
			text:
				'First FOUR questions of each section have four options, out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions.push({
			text:
				'Next TEN questions, each of which has four options. ONE OR MORE THAN ONE of these four options is (are) correct option(s). For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions.push({
			text:
				'The last FOUR questions of each section has NUMERICAL VALUE as answer. If the numerical value has more than two decimal places, truncate/round-off the value to TWO decimal places. For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions[0].markingScheme.push({
			text:
				'Full Marks : +3 If only the option corresponding to the correct answer is selected.',
		});

		sectionInstructions[0].markingScheme.push({
			text: 'Zero Marks : 0 If none of the options is selected.',
		});

		sectionInstructions[0].markingScheme.push({
			text: 'Negative Marks : –1 In all other cases',
		});

		sectionInstructions[1].markingScheme.push({
			text: 'Full Marks : +4 If only (all) the correct option(s) is (are) chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Partial Marks : +3 If all the four options are correct but ONLY three options are chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Partial Marks : +2 If three or more options are correct but ONLY two correct options are chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Partial Marks : +1 If two or more options are correct but ONLY one correct option is chosen.',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Zero Marks : 0 If none of the options is chosen (i.e. the question is unanswered).',
		});

		sectionInstructions[1].markingScheme.push({
			text: 'Negative Marks : -2 In all other cases.',
		});

		sectionInstructions[2].markingScheme.push({
			text:
				'Full Marks : +3 If ONLY the correct numerical value is entered as answer.',
		});

		sectionInstructions[2].markingScheme.push({
			text: 'Zero Marks : 0 In all other cases.',
		});
	} else if (draft.instructionType === '20SCQ5NUM') {
		sectionInstructions.push({
			text:
				'First TWENTY questions of each section have four options, out of which ONLY ONE is correct. For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions.push({
			text:
				'Next FIVE questions of each section has NUMERICAL VALUE as answer. If the numerical value has more than two decimal places, truncate/round-off the value to TWO decimal places. For each of these question, marks will be awarded in one of the following categories:',
			markingScheme: [],
		});

		sectionInstructions[0].markingScheme.push({
			text:
				'Full Marks : +4 If only the option corresponding to the correct answer is selected.',
		});

		sectionInstructions[0].markingScheme.push({
			text: 'Zero Marks : 0 If none of the options is selected.',
		});

		sectionInstructions[0].markingScheme.push({
			text: 'Negative Marks : –1 In all other cases',
		});

		sectionInstructions[1].markingScheme.push({
			text:
				'Full Marks : +4 If ONLY the correct numerical value is entered as answer.',
		});

		sectionInstructions[1].markingScheme.push({
			text: 'Zero Marks : 0 In all other cases.',
		});
	}

	return sectionInstructions;
}

function publish(req, res) {
	const { id } = req.body;
	Draft.findById(id)
		.exec()
		.then((draft) => {
			const instructions = generateInstructions(draft);
			const sectionInstructions = generateSectionInstructions(draft);
			const syllabus = generateSyllabus(draft);

			const assessmentCore = new AssessmentCore({
				identifier: draft.name,
				instructions,
				sectionInstructions,
				customInstructions: draft.customInstructions,
				syllabus: {
					topics: syllabus,
				},
				duration: draft.duration,
				sections: draft.sections,
				sectionGroups: draft.sectionGroups,
				supergroup: draft.supergroup,
				wrappers: [],
				markingScheme: draft.markingScheme,
				config: draft.config,
				client: draft.client,
			});

			assessmentCore.save().then((savedCore) => {
				const coreAnalysis = new CoreAnalysis({
					marks: [],
					hist: [0, 0, 0, 0, 0, 0],
					sections: savedCore.sections.map((s) => ({
						id: s._id,
						marks: [],
						hist: [0, 0, 0, 0, 0, 0],
						questions: s.questions.map((q) => ({
							id: q._id,
						})),
					})),
					difficulty: {
						easy: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
						medium: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
						hard: { correct: 0, incorrect: 0, time: 0, totalAttempts: 0 },
					},
				});

				coreAnalysis.save().then((savedCoreAnalysis) => {
					savedCore.analysis = savedCoreAnalysis._id;
					savedCore.markModified('analysis');
					savedCore.save();
				});

				const questionIds = [];
				assessmentCore.sections.forEach((s) => {
					s.questions.forEach((q) => {
						questionIds.push(q.question);
					});
				});
				Question.updateMany(
					{ _id: { $in: questionIds } },
					{ $set: { used: savedCore._id }, $addToSet: { usedIn: savedCore._id } }
				)
					.exec()
					.then(() => {
						res.json({ success: true, assessment: savedCore });
					});
			});
		});
}

function getDraft(req, res) {
	Draft.findById(req.params.draftId)
		.populate('sections.questions.question')
		.exec()
		.then((draft) => {
			res.json(draft);
		});
}

module.exports = { clone, list, save, getDraft, update, publish, archive };
