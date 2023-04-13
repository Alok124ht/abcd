const moment = require('moment');
const { get, map } = require('lodash');
const { Types } = require('mongoose');
const Question = require('./question.model').default;
const QuestionStatistics = require('./QuestionStatistics.model');
const Log = require('../log/log.model');
const User = require('../user/user.model').default;
const Client = require('../client/client.model').default;
const Topic = require('../topic/topic.model').default;
const Discussion = require('../discussion/discussion.model').default;
const Email = require('../email/email.model');
const constants = require('../constants.js');
const { calculateAndUpdateStatsForQuestions } = require('./utils');
const lib = require('../lib.js');
const APIError = require('../helpers/APIError');
const cacheManager = require('../cache/cache-manager');
const Attempt = require('../models/Attempt').default;
const { secureDiscussion } = require('../discussion/utils');

const { shuffle } = lib;
const memoryCache = cacheManager({});
const { questionTypeMap: newTypeMap } = constants;
const { ObjectId } = Types;

/**
 * Get question
 */
function getQuestion(req, res) {
	return Question.get(req.params.questionId)
		.then((question) => res.json(question))
		.catch(() => res.status(404).json({ error: { message: '404 Not Found' } }));
}

function getMany(req, res) {
	// send only assigned category questions
	const {
		payload: { role, id },
	} = req;
	const limit = Number.isNaN(parseInt(req.body.limit, 10))
		? 20
		: parseInt(req.body.limit, 10);

	if (role === 'moderator') {
		Client.findOne({ moderators: ObjectId(id) }).then((client) => {
			if (client) {
				return Question.getMany(
					req.body.tag,
					req.body.sub_topic,
					req.body.questionType,
					req.body.questionState,
					req.body.level,
					req.body.showHidden,
					req.body.skip,
					limit,
					client._id,
					req.body.dataType,
					req.body.tags,
					req.body.concepts,
					req.body.questionIds
				)
					.then(({ questions, total }) => {
						res.json({ questions, total });
					})
					.catch(() => {
						res.status(404).json({ error: { message: '404 Not Found' } });
					});
			}
			res.json({ success: false });
		});
	} else {
		Question.getMany(
			req.body.tag,
			req.body.sub_topic,
			req.body.questionType,
			req.body.questionState,
			req.body.level,
			req.body.showHidden,
			req.body.skip,
			limit,
			'',
			req.body.dataType,
			req.body.tags,
			req.body.concepts,
			req.body.questionIds
		)
			.then(({ questions, total }) => {
				res.json({ questions, total });
			})
			.catch((error) => {
				console.error(error);
				res.status(404).json({ error: { message: '404 Not Found' } });
			});
	}
}

function getReported(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	Question.getReported(req.body.skip)
		.then((questions) => {
			res.json(questions);
		})
		.catch(() => {
			res.status(404).json({ error: { message: '404 Not Found' } });
		});
}

function addWithUniqueTag(req, res) {
	const { question, tag } = req.body;
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const tn = new Date(new Date().getTime() - 24 * 3600 * 1000);
	Question.findOne({ tag, createdAt: { $gte: tn } })
		.then((q) => {
			if (q) {
				res.json({ success: false, error: 'already-added' });
			} else if (question.questionType === 'SINGLE_CORRECT') {
				const q_ = new Question({
					content: {
						rawContent: question.questionText,
					},
					type: 'MULTIPLE_CHOICE_SINGLE_CORRECT',
					options: question.options.map((o, idx) => ({
						isCorrect: question.correctOptions.indexOf(idx) !== -1,
						content: { rawContent: o },
					})),
					tag,
					topic: '5c9a660e01d3a533d7c16aaf',
					sub_topic: '5ce27baeff96dd1f72ce9011',
					solution: { rawContent: question.explanation },
					verifiedBy: id,
				});
				q_.save().then(() => {
					res.json({ success: true });
				});
			} else if (question.questionType === 'MULTIPLE_CORRECT') {
				const q_ = new Question({
					content: {
						rawContent: question.questionText,
					},
					type: 'MULTIPLE_CHOICE_MULTIPLE_CORRECT',
					multiOptions: question.options.map((o, idx) => ({
						isCorrect: question.correctOptions.indexOf(idx) !== -1,
						content: { rawContent: o },
					})),
					tag,
					topic: '5c9a660e01d3a533d7c16aaf',
					sub_topic: '5ce27baeff96dd1f72ce9011',
					solution: { rawContent: question.explanation },
					verifiedBy: id,
				});
				q_.save().then(() => {
					res.json({ success: true });
				});
			} else if (question.questionType === 'RANGE') {
				const q_ = new Question({
					content: {
						rawContent: question.questionText,
					},
					type: 'RANGE',
					range: { start: question.answerFrom, end: question.answerTo },
					tag,
					topic: '5c9a660e01d3a533d7c16aaf',
					sub_topic: '5ce27baeff96dd1f72ce9011',
					solution: { rawContent: question.explanation },
					verifiedBy: id,
				});
				q_.save().then(() => {
					res.json({ success: true });
				});
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}

/**
 * Create new question
 * @property {string} req.body.content - The content of question which can be parsed by DraftJS.
 * @property {string} req.body.type - The question type.
 * @returns {Question}
 */

function create(req, res) {
	// check admin
	const { question } = req.body;
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	Topic.list().then((topics) => {
		let topic = '';
		let sub_topic = '';
		let topicIdx = -1;
		let subtopicIdx = -1;
		topics.topics.forEach((topic_, idx1) => {
			topic_.sub_topics.forEach((sub_topic_, idx2) => {
				if (sub_topic_.id == question.topicId) {
					topic = topic_._id;
					sub_topic = sub_topic_._id;
					topicIdx = idx1;
					subtopicIdx = idx2;
				}
			});
		});

		const question_ = {};
		question_.hasEquation = question.hasEquation;
		question_.isVerified = question.isVerified;
		question_.hasImage = question.hasImage;
		question_.level = question.level;
		question_.topicId = question.topicId;
		question_.topic = topic;
		question_.sub_topic = sub_topic;
		question_.category = question.category ? question.category : '';
		question_.dataType = question.dataType ? question.dataType : 'text';
		question_.tag = question.tag.toLowerCase();
		question_.tags = question.tags;
		question_.concepts = question.concepts;

		question_.solution = {
			rawContent: JSON.stringify(question.rawSolution),
		};
		question_.hint = {
			rawContent: JSON.stringify(question.rawHint),
		};
		question_.content = {
			rawContent: JSON.stringify(question.rawQuestion),
		};
		const { options } = question;
		const optionsArray = Object.keys(options).map((key) => {
			const isCorrect = question.answer === key;
			if (question.dataType !== 'image') {
				return {
					isCorrect,
					content: {
						rawContent: JSON.stringify(options[key].rawContent),
					},
				};
			}
			return {
				isCorrect,
				content: {},
			};
		});
		question_.options = question.processedOptions
			? question.processedOptions
			: optionsArray;
		question_.addedBy = id;

		if (role === 'moderator') {
			Client.find({ moderators: ObjectId(id) }).then((client) => {
				if (client) {
					question_.client = client._id;
					const question__ = new Question(question_);
					question__.save().then((savedQuestion) => {
						QuestionStatistics.findByQuestionId(savedQuestion._id);
						if (topicIdx !== -1 && subtopicIdx !== -1) {
							const selector = {};
							const operator = {};
							selector[
								`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
							] = 1;
							operator.$inc = selector;
							Topic.update({ _id: topics._id }, operator).then(() => {
								res.json({ success: true, savedQuestion: savedQuestion });
							});
						} else {
							// Log error, topic/subtopic not found
							res.json({ success: true, savedQuestion: savedQuestion });
						}
					});
				} else {
					res.json({ success: false });
				}
			});
		} else {
			const question__ = new Question(question_);
			question__.save().then((savedQuestion) => {
				QuestionStatistics.findByQuestionId(savedQuestion._id);
				if (topicIdx !== -1 && subtopicIdx !== -1) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
					] = 1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, savedQuestion: savedQuestion });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, savedQuestion: savedQuestion });
				}
			});
		}
	});
}

function archive(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	const { id } = req.body;
	Question.update({ _id: id }, { $set: { isArchived: true } }).then(() => {
		res.json({ success: true });
	});
}

function hideInSearch(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	const { id } = req.body;
	Question.update({ _id: id }, { $set: { hiddenInSearch: true } }).then(() => {
		res.json({ success: true });
	});
}

function createMultiCorrect(req, res) {
	// check admin
	const { question } = req.body;
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	// let totalCorrect = 0;
	// Object.keys(question.options).map((key) => {
	// 	totalCorrect += question.options[key].isCorrect ? 1 : 0;
	// });

	// if (totalCorrect < 2) {
	// 	res.json({ success: false });
	// 	return;
	// }

	Topic.list().then((topics) => {
		let topic = '';
		let sub_topic = '';
		let topicIdx = -1;
		let subtopicIdx = -1;
		topics.topics.forEach((topic_, idx1) => {
			topic_.sub_topics.forEach((sub_topic_, idx2) => {
				if (sub_topic_.id == question.topicId) {
					topic = topic_._id;
					sub_topic = sub_topic_._id;
					topicIdx = idx1;
					subtopicIdx = idx2;
				}
			});
		});

		const question_ = { type: 'MULTIPLE_CHOICE_MULTIPLE_CORRECT' };
		question_.hasEquation = question.hasEquation;
		question_.isVerified = question.isVerified;
		question_.hasImage = question.hasImage;
		question_.level = question.level;
		question_.topicId = question.topicId;
		question_.topic = topic;
		question_.sub_topic = sub_topic;
		question_.category = question.category ? question.category : '';
		question_.dataType = question.dataType ? question.dataType : 'text';
		question_.tag = question.tag.toLowerCase();
		question_.tags = question.tags;
		question_.concepts = question.concepts;

		question_.solution = {
			rawContent: JSON.stringify(question.rawSolution),
		};
		question_.hint = {
			rawContent: JSON.stringify(question.rawHint),
		};
		question_.content = {
			rawContent: JSON.stringify(question.rawQuestion),
		};
		const { options } = question;
		const optionsArray = Object.keys(options).map((key) => {
			if (question.dataType !== 'image') {
				return {
					isCorrect: options[key].isCorrect,
					content: {
						rawContent: JSON.stringify(options[key].rawContent),
					},
				};
			}
			return {
				isCorrect: options[key].isCorrect,
				content: {},
			};
		});
		question_.multiOptions = question.processedOptions
			? question.processedOptions
			: optionsArray;
		question_.addedBy = id;

		if (role === 'moderator') {
			Client.find({ moderators: ObjectId(id) }).then((client) => {
				if (client) {
					question_.client = client._id;
					const question__ = new Question(question_);
					question__.save().then((savedQuestion) => {
						QuestionStatistics.findByQuestionId(savedQuestion._id);
						if (topicIdx !== -1 && subtopicIdx !== -1) {
							const selector = {};
							const operator = {};
							selector[
								`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
							] = 1;
							operator.$inc = selector;
							Topic.update({ _id: topics._id }, operator).then(() => {
								res.json({ success: true, savedQuestion: savedQuestion });
							});
						} else {
							// Log error, topic/subtopic not found
							res.json({ success: true, savedQuestion: savedQuestion });
						}
					});
				} else {
					res.json({ success: false });
				}
			});
		} else {
			const question__ = new Question(question_);
			question__.save().then((savedQuestion) => {
				QuestionStatistics.findByQuestionId(savedQuestion._id);
				if (topicIdx !== -1 && subtopicIdx !== -1) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
					] = 1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, savedQuestion: savedQuestion });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, savedQuestion: savedQuestion });
				}
			});
		}
	});
}

function createInteger(req, res) {
	// check admin
	const { question } = req.body;
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	Topic.list().then((topics) => {
		let topic = '';
		let sub_topic = '';
		let topicIdx = -1;
		let subtopicIdx = -1;
		topics.topics.forEach((topic_, idx1) => {
			topic_.sub_topics.forEach((sub_topic_, idx2) => {
				if (sub_topic_.id == question.topicId) {
					topic = topic_._id;
					sub_topic = sub_topic_._id;
					topicIdx = idx1;
					subtopicIdx = idx2;
				}
			});
		});

		const question_ = { type: 'INTEGER' };
		question_.hasEquation = question.hasEquation;
		question_.isVerified = question.isVerified;
		question_.hasImage = question.hasImage;
		question_.level = question.level;
		question_.topicId = question.topicId;
		question_.topic = topic;
		question_.sub_topic = sub_topic;
		question_.category = question.category ? question.category : '';
		question_.dataType = question.dataType ? question.dataType : 'text';
		question_.tag = question.tag.toLowerCase();
		question_.tags = question.tags;
		question_.concepts = question.concepts;

		question_.solution = {
			rawContent: JSON.stringify(question.rawSolution),
		};
		question_.hint = {
			rawContent: JSON.stringify(question.rawHint),
		};
		question_.content = {
			rawContent: JSON.stringify(question.rawQuestion),
		};
		question_.integerAnswer = question.answer;
		question_.addedBy = id;

		if (role === 'moderator') {
			Client.find({ moderators: ObjectId(id) }).then((client) => {
				if (client) {
					question_.client = client._id;
					const question__ = new Question(question_);
					question__.save().then((savedQuestion) => {
						QuestionStatistics.findByQuestionId(savedQuestion._id);
						if (topicIdx !== -1 && subtopicIdx !== -1) {
							const selector = {};
							const operator = {};
							selector[
								`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
							] = 1;
							operator.$inc = selector;
							Topic.update({ _id: topics._id }, operator).then(() => {
								res.json({ success: true, savedQuestion: savedQuestion });
							});
						} else {
							// Log error, topic/subtopic not found
							res.json({ success: true, savedQuestion: savedQuestion });
						}
					});
				} else {
					res.json({ success: false });
				}
			});
		} else {
			const question__ = new Question(question_);
			question__.save().then((savedQuestion) => {
				QuestionStatistics.findByQuestionId(savedQuestion._id);
				if (topicIdx !== -1 && subtopicIdx !== -1) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
					] = 1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, savedQuestion: savedQuestion });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, savedQuestion: savedQuestion });
				}
			});
		}
	});
}

function createRange(req, res) {
	// check admin
	const { question } = req.body;
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	Topic.list().then((topics) => {
		let topic = '';
		let sub_topic = '';
		let topicIdx = -1;
		let subtopicIdx = -1;
		topics.topics.forEach((topic_, idx1) => {
			topic_.sub_topics.forEach((sub_topic_, idx2) => {
				if (sub_topic_.id == question.topicId) {
					topic = topic_._id;
					sub_topic = sub_topic_._id;
					topicIdx = idx1;
					subtopicIdx = idx2;
				}
			});
		});

		const question_ = { type: 'RANGE' };
		question_.hasEquation = question.hasEquation;
		question_.isVerified = question.isVerified;
		question_.hasImage = question.hasImage;
		question_.level = question.level;
		question_.topicId = question.topicId;
		question_.topic = topic;
		question_.sub_topic = sub_topic;
		question_.category = question.category ? question.category : '';
		question_.dataType = question.dataType ? question.dataType : 'text';
		question_.tag = question.tag.toLowerCase();
		question_.tags = question.tags;
		question_.concepts = question.concepts;

		question_.solution = {
			rawContent: JSON.stringify(question.rawSolution),
		};
		question_.hint = {
			rawContent: JSON.stringify(question.rawHint),
		};
		question_.content = {
			rawContent: JSON.stringify(question.rawQuestion),
		};
		question_.range = question.range;
		question_.addedBy = id;

		if (role === 'moderator') {
			Client.find({ moderators: ObjectId(id) }).then((client) => {
				if (client) {
					question_.client = client._id;
					const question__ = new Question(question_);
					question__.save().then((savedQuestion) => {
						QuestionStatistics.findByQuestionId(savedQuestion._id);
						if (topicIdx !== -1 && subtopicIdx !== -1) {
							const selector = {};
							const operator = {};
							selector[
								`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
							] = 1;
							operator.$inc = selector;
							Topic.update({ _id: topics._id }, operator).then(() => {
								res.json({ success: true, savedQuestion: savedQuestion });
							});
						} else {
							// Log error, topic/subtopic not found
							res.json({ success: true, savedQuestion: savedQuestion });
						}
					});
				} else {
					res.json({ success: false });
				}
			});
		} else {
			const question__ = new Question(question_);
			question__.save().then((savedQuestion) => {
				QuestionStatistics.findByQuestionId(savedQuestion._id);
				if (topicIdx !== -1 && subtopicIdx !== -1) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
					] = 1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, savedQuestion: savedQuestion });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, savedQuestion: savedQuestion });
				}
			});
		}
	});
}

function createMTC(req, res) {
	// check admin
	const { question } = req.body;
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	Topic.list().then((topics) => {
		let topic = '';
		let sub_topic = '';
		let topicIdx = -1;
		let subtopicIdx = -1;
		topics.topics.forEach((topic_, idx1) => {
			topic_.sub_topics.forEach((sub_topic_, idx2) => {
				if (sub_topic_.id == question.topicId) {
					topic = topic_._id;
					sub_topic = sub_topic_._id;
					topicIdx = idx1;
					subtopicIdx = idx2;
				}
			});
		});

		const question_ = { type: 'MATCH_THE_COLUMNS' };
		question_.hasEquation = question.hasEquation;
		question_.isVerified = question.isVerified;
		question_.hasImage = question.hasImage;
		question_.level = question.level;
		question_.topicId = question.topicId;
		question_.topic = topic;
		question_.sub_topic = sub_topic;
		question_.category = question.category ? question.category : '';
		question_.dataType = question.dataType ? question.dataType : 'text';
		question_.tag = question.tag.toLowerCase();
		question_.tags = question.tags;
		question_.concepts = question.concepts;

		question_.solution = {
			rawContent: JSON.stringify(question.rawSolution),
		};
		question_.hint = {
			rawContent: JSON.stringify(question.rawHint),
		};
		question_.content = {
			rawContent: JSON.stringify(question.rawQuestion),
		};
		question_.columns = {
			col1: question.columns.col1.map((c1) => ({
				content: { rawContent: JSON.stringify(c1.content) },
				matches: c1.matches,
			})),
			col2: question.columns.col2.map((c2) => ({
				content: { rawContent: JSON.stringify(c2.content) },
			})),
		};

		question_.addedBy = id;

		if (role === 'moderator') {
			Client.find({ moderators: ObjectId(id) }).then((client) => {
				if (client) {
					question_.client = client._id;
					const question__ = new Question(question_);
					question__.save().then((savedQuestion) => {
						QuestionStatistics.findByQuestionId(savedQuestion._id);
						if (topicIdx !== -1 && subtopicIdx !== -1) {
							const selector = {};
							const operator = {};
							selector[
								`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
							] = 1;
							operator.$inc = selector;
							Topic.update({ _id: topics._id }, operator).then(() => {
								res.json({ success: true });
							});
						} else {
							// Log error, topic/subtopic not found
							res.json({ success: true });
						}
					});
				} else {
					res.json({ success: false });
				}
			});
		} else {
			const question__ = new Question(question_);
			question__.save().then((savedQuestion) => {
				QuestionStatistics.findByQuestionId(savedQuestion._id);
				if (topicIdx !== -1 && subtopicIdx !== -1) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
					] = 1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true });
				}
			});
		}
	});
}

function matchOptionIds(options1, options2) {
	// return true;
	if (!options1 || !options2) return false;
	if (options1.length !== options2.length) return false;
	for (let i = 0; i < options1.length; i += 1) {
		if (options1[i]._id.toString() != options2[i]._id.toString()) return false;
	}
	return true;
}

function update(req, res) {
	// should we reset stats of question is updated???
	// change no of verified/published on topic/subtopic change!!!
	// ideally we should not update published question. if we do, we should publish it again!!!
	// show notification when editing published question!!
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const { question } = req.body;

	Question.get(question._id).then((que) => {
		// if (!matchOptionIds(question.options, que.options)) {
		// 	res.json({ success: false, error: { code: 'options-not-matched' } });
		// 	return;
		// }
		Topic.list().then((topics) => {
			let topic = '';
			let sub_topic = '';
			let topicIdx1 = -1;
			let subtopicIdx1 = -1;
			let topicIdx2 = -1;
			let subtopicIdx2 = -1;
			const verified = que.isVerified ? 1 : 0;
			topics.topics.forEach((topic_, idx1) => {
				topic_.sub_topics.forEach((sub_topic_, idx2) => {
					if (sub_topic_.id == question.topicId) {
						topic = topic_._id;
						sub_topic = sub_topic_._id;
						sub_topic_.total_questions += 1;
						topicIdx1 = idx1;
						subtopicIdx1 = idx2;
					}
					if (sub_topic_.id == que.topicId) {
						sub_topic_.total_questions -= 1;
						topicIdx2 = idx1;
						subtopicIdx2 = idx2;
					}
				});
			});

			if (que.isPublished && (que.sub_topic != sub_topic || que.topic != topic)) {
				res.json({ success: false });
				return;
			}

			que.hasEquation = question.hasEquation;
			que.hasImage = question.hasImage;
			que.topicId = question.topicId; // change count of questions!!!
			que.solution = { rawContent: question.solution.rawContent };
			que.hint = { rawContent: question.hint.rawContent };
			que.content = { rawContent: question.content.rawContent };
			que.tag = question.tag;
			que.level = question.level;
			que.category = question.category ? question.category : '';
			que.dataType = question.dataType ? question.dataType : 'text';
			que.concepts = question.concepts ? question.concepts : [];
			que.set('tags', question.tags ? question.tags : []);

			let reduceVerified = false;
			if (!que.isPublished && que.isVerified) reduceVerified = true;
			if (!que.isPublished) {
				// if question is published, we can't unpublish it as stats would go wrong.
				// so we need to mark it verified too.
				// check subtopic and other things also if question is published!
				que.set('isVerified', false);
				que.set('verifiedBy', '');
				que.markModified('isVerified');
				que.markModified('verifiedBy');
			}

			que.topic = topic;
			que.sub_topic = sub_topic;

			que.options = question.options;
			// que.options.forEach((o, idx) => {
			// 	o.isCorrect = question.options[idx].isCorrect;
			// 	if (question.dataType !== 'image') {
			// 		o.content = {
			// 			rawContent: question.options[idx].content.rawContent,
			// 		};
			// 	}
			// });

			que.markModified('hasEquation');
			que.markModified('hasImage');
			que.markModified('topicId');
			que.markModified('topic');
			que.markModified('sub_topic');
			que.markModified('solution');
			que.markModified('hint');
			que.markModified('content');
			que.markModified('tag');
			que.markModified('level');
			que.markModified('category');
			que.markModified('dataType');
			que.markModified('isPublished');
			que.markModified('options');
			que.markModified('concepts');

			que.save().then(() => {
				if (topicIdx1 === topicIdx2 && subtopicIdx1 === subtopicIdx2) {
					if (
						topicIdx1 !== -1 &&
						subtopicIdx1 !== -1 &&
						topicIdx2 !== -1 &&
						subtopicIdx2 !== -1 &&
						reduceVerified
					) {
						const selector = {};
						const operator = {};
						selector[
							`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
						] = -verified;
						operator.$inc = selector;
						Topic.update({ _id: topics._id }, operator).then(() => {
							res.json({ success: true, updatedQuestion: que });
						});
					} else {
						res.json({ success: true, updatedQuestion: que });
					}
				} else if (
					topicIdx1 !== -1 &&
					subtopicIdx1 !== -1 &&
					topicIdx2 !== -1 &&
					subtopicIdx2 !== -1
				) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.total_questions`
					] = 1;
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
					] = -verified;
					selector[
						`topics.${topicIdx2}.sub_topics.${subtopicIdx2}.total_questions`
					] = -1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, updatedQuestion: que });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, updatedQuestion: que });
				}
			});
		});
	});
}

function updateMultiCorrect(req, res) {
	// should we reset stats of question is updated???
	// change no of verified/published on topic/subtopic change!!!
	// ideally we should not update published question. if we do, we should publish it again!!!
	// show notification when editing published question!!
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false, c: 0 });
		return;
	}
	const { question } = req.body;

	// let totalCorrect = 0;
	// Object.keys(question.multiOptions).map((key) => {
	// 	totalCorrect += question.multiOptions[key].isCorrect ? 1 : 0;
	// });
	// if (totalCorrect < 2) {
	// 	res.json({ success: false, c: 1 });
	// 	return;
	// }

	Question.get(question._id).then((que) => {
		// if (!matchOptionIds(question.multiOptions, que.multiOptions)) {
		// 	res.json({ success: false, c: 2 });
		// 	return;
		// }
		Topic.list().then((topics) => {
			let topic = '';
			let sub_topic = '';
			let topicIdx1 = -1;
			let subtopicIdx1 = -1;
			let topicIdx2 = -1;
			let subtopicIdx2 = -1;
			const verified = que.isVerified ? 1 : 0;
			topics.topics.forEach((topic_, idx1) => {
				topic_.sub_topics.forEach((sub_topic_, idx2) => {
					if (sub_topic_.id == question.topicId) {
						topic = topic_._id;
						sub_topic = sub_topic_._id;
						sub_topic_.total_questions += 1;
						topicIdx1 = idx1;
						subtopicIdx1 = idx2;
					}
					if (sub_topic_.id == que.topicId) {
						sub_topic_.total_questions -= 1;
						topicIdx2 = idx1;
						subtopicIdx2 = idx2;
					}
				});
			});

			if (que.isPublished && (que.sub_topic != sub_topic || que.topic != topic)) {
				res.json({ success: false });
				return;
			}

			que.hasEquation = question.hasEquation;
			que.hasImage = question.hasImage;
			que.topicId = question.topicId; // change count of questions!!!
			que.solution = { rawContent: question.solution.rawContent };
			que.hint = { rawContent: question.hint.rawContent };
			que.content = { rawContent: question.content.rawContent };
			que.tag = question.tag;
			que.set('tags', question.tags || []);
			que.level = question.level;
			que.category = question.category ? question.category : '';
			que.dataType = question.dataType ? question.dataType : 'text';
			que.concepts = question.concepts ? question.concepts : [];

			let reduceVerified = false;
			if (!que.isPublished && que.isVerified) reduceVerified = true;
			if (!que.isPublished) {
				// if question is published, we can't unpublish it as stats would go wrong.
				// so we need to mark it verified too.
				// check subtopic and other things also if question is published!
				que.isVerified = false;
				que.verifiedBy = '';
				que.markModified('isVerified');
				que.markModified('verifiedBy');
			}

			que.topic = topic;
			que.sub_topic = sub_topic;
			que.multiOptions = question.multiOptions;
			// que.multiOptions.forEach((o, idx) => {
			// 	if (question.dataType !== 'image') {
			// 		o.isCorrect = question.multiOptions[idx].isCorrect;
			// 		o.content = {
			// 			rawContent: question.multiOptions[idx].content.rawContent,
			// 		};
			// 	} else {
			// 		o.isCorrect = question.multiOptions[idx].isCorrect;
			// 	}
			// });

			que.markModified('hasEquation');
			que.markModified('hasImage');
			que.markModified('topicId');
			que.markModified('topic');
			que.markModified('sub_topic');
			que.markModified('solution');
			que.markModified('hint');
			que.markModified('content');
			que.markModified('tag');
			que.markModified('level');
			que.markModified('category');
			que.markModified('dataType');
			que.markModified('isPublished');
			que.markModified('multiOptions');

			que.save().then(() => {
				if (topicIdx1 === topicIdx2 && subtopicIdx1 === subtopicIdx2) {
					if (
						topicIdx1 !== -1 &&
						subtopicIdx1 !== -1 &&
						topicIdx2 !== -1 &&
						subtopicIdx2 !== -1 &&
						reduceVerified
					) {
						const selector = {};
						const operator = {};
						selector[
							`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
						] = -verified;
						operator.$inc = selector;
						Topic.update({ _id: topics._id }, operator).then(() => {
							res.json({ success: true, updatedQuestion: que });
						});
					} else {
						res.json({ success: true, updatedQuestion: que });
					}
				} else if (
					topicIdx1 !== -1 &&
					subtopicIdx1 !== -1 &&
					topicIdx2 !== -1 &&
					subtopicIdx2 !== -1
				) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.total_questions`
					] = 1;
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
					] = -verified;
					selector[
						`topics.${topicIdx2}.sub_topics.${subtopicIdx2}.total_questions`
					] = -1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, updatedQuestion: que });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, updatedQuestion: que });
				}
			});
		});
	});
}

function updateInteger(req, res) {
	// should we reset stats of question is updated???
	// change no of verified/published on topic/subtopic change!!!
	// ideally we should not update published question. if we do, we should publish it again!!!
	// show notification when editing published question!!
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false, c: 0 });
		return;
	}
	const { question } = req.body;

	Question.get(question._id).then((que) => {
		Topic.list().then((topics) => {
			let topic = '';
			let sub_topic = '';
			let topicIdx1 = -1;
			let subtopicIdx1 = -1;
			let topicIdx2 = -1;
			let subtopicIdx2 = -1;
			const verified = que.isVerified ? 1 : 0;
			topics.topics.forEach((topic_, idx1) => {
				topic_.sub_topics.forEach((sub_topic_, idx2) => {
					if (sub_topic_.id == question.topicId) {
						topic = topic_._id;
						sub_topic = sub_topic_._id;
						sub_topic_.total_questions += 1;
						topicIdx1 = idx1;
						subtopicIdx1 = idx2;
					}
					if (sub_topic_.id == que.topicId) {
						sub_topic_.total_questions -= 1;
						topicIdx2 = idx1;
						subtopicIdx2 = idx2;
					}
				});
			});

			if (que.isPublished && (que.sub_topic != sub_topic || que.topic != topic)) {
				res.json({ success: false });
				return;
			}

			que.hasEquation = question.hasEquation;
			que.hasImage = question.hasImage;
			que.topicId = question.topicId; // change count of questions!!!
			que.solution = { rawContent: JSON.stringify(question.solution.rawContent) };
			que.hint = { rawContent: JSON.stringify(question.hint.rawContent) };
			que.content = { rawContent: JSON.stringify(question.content.rawContent) };
			que.tag = question.tag;
			que.set('tags', question.tags || []);
			que.level = question.level;
			que.category = question.category ? question.category : '';
			que.dataType = question.dataType ? question.dataType : 'text';
			que.concepts = question.concepts ? question.concepts : [];

			let reduceVerified = false;
			if (!que.isPublished && que.isVerified) reduceVerified = true;
			if (!que.isPublished) {
				// if question is published, we can't unpublish it as stats would go wrong.
				// so we need to mark it verified too.
				// check subtopic and other things also if question is published!
				que.isVerified = false;
				que.verifiedBy = '';
				que.markModified('isVerified');
				que.markModified('verifiedBy');
			}

			que.topic = topic;
			que.sub_topic = sub_topic;
			que.integerAnswer = question.answer;

			que.markModified('hasEquation');
			que.markModified('hasImage');
			que.markModified('topicId');
			que.markModified('topic');
			que.markModified('sub_topic');
			que.markModified('solution');
			que.markModified('hint');
			que.markModified('content');
			que.markModified('tag');
			que.markModified('level');
			que.markModified('category');
			que.markModified('dataType');
			que.markModified('isPublished');
			que.markModified('integerAnswer');

			que.save().then(() => {
				if (topicIdx1 === topicIdx2 && subtopicIdx1 === subtopicIdx2) {
					if (
						topicIdx1 !== -1 &&
						subtopicIdx1 !== -1 &&
						topicIdx2 !== -1 &&
						subtopicIdx2 !== -1 &&
						reduceVerified
					) {
						const selector = {};
						const operator = {};
						selector[
							`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
						] = -verified;
						operator.$inc = selector;
						Topic.update({ _id: topics._id }, operator).then(() => {
							res.json({ success: true, updatedQuestion: que });
						});
					} else {
						res.json({ success: true, updatedQuestion: que });
					}
				} else if (
					topicIdx1 !== -1 &&
					subtopicIdx1 !== -1 &&
					topicIdx2 !== -1 &&
					subtopicIdx2 !== -1
				) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.total_questions`
					] = 1;
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
					] = -verified;
					selector[
						`topics.${topicIdx2}.sub_topics.${subtopicIdx2}.total_questions`
					] = -1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, updatedQuestion: que });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, updatedQuestion: que });
				}
			});
		});
	});
}

function updateRange(req, res) {
	// should we reset stats of question is updated???
	// change no of verified/published on topic/subtopic change!!!
	// ideally we should not update published question. if we do, we should publish it again!!!
	// show notification when editing published question!!
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false, c: 0 });
		return;
	}
	const { question } = req.body;

	Question.get(question._id).then((que) => {
		Topic.list().then((topics) => {
			let topic = '';
			let sub_topic = '';
			let topicIdx1 = -1;
			let subtopicIdx1 = -1;
			let topicIdx2 = -1;
			let subtopicIdx2 = -1;
			const verified = que.isVerified ? 1 : 0;
			topics.topics.forEach((topic_, idx1) => {
				topic_.sub_topics.forEach((sub_topic_, idx2) => {
					if (sub_topic_.id == question.topicId) {
						topic = topic_._id;
						sub_topic = sub_topic_._id;
						sub_topic_.total_questions += 1;
						topicIdx1 = idx1;
						subtopicIdx1 = idx2;
					}
					if (sub_topic_.id == que.topicId) {
						sub_topic_.total_questions -= 1;
						topicIdx2 = idx1;
						subtopicIdx2 = idx2;
					}
				});
			});

			if (que.isPublished && (que.sub_topic != sub_topic || que.topic != topic)) {
				res.json({ success: false });
				return;
			}

			que.hasEquation = question.hasEquation;
			que.hasImage = question.hasImage;
			que.topicId = question.topicId; // change count of questions!!!
			que.solution = { rawContent: question.solution.rawContent };
			que.hint = { rawContent: question.hint.rawContent };
			que.content = { rawContent: question.content.rawContent };
			que.tag = question.tag;
			que.set('tags', question.tags || []);
			que.level = question.level;
			que.category = question.category ? question.category : '';
			que.dataType = question.dataType ? question.dataType : 'text';
			que.concepts = question.concepts ? question.concepts : [];

			let reduceVerified = false;
			if (!que.isPublished && que.isVerified) reduceVerified = true;
			if (!que.isPublished) {
				// if question is published, we can't unpublish it as stats would go wrong.
				// so we need to mark it verified too.
				// check subtopic and other things also if question is published!
				que.isVerified = false;
				que.verifiedBy = '';
				que.markModified('isVerified');
				que.markModified('verifiedBy');
			}

			que.topic = topic;
			que.sub_topic = sub_topic;
			que.range = question.range;

			que.markModified('hasEquation');
			que.markModified('hasImage');
			que.markModified('topicId');
			que.markModified('topic');
			que.markModified('sub_topic');
			que.markModified('solution');
			que.markModified('hint');
			que.markModified('content');
			que.markModified('tag');
			que.markModified('level');
			que.markModified('category');
			que.markModified('dataType');
			que.markModified('isPublished');
			que.markModified('range');

			que.save().then(() => {
				if (topicIdx1 === topicIdx2 && subtopicIdx1 === subtopicIdx2) {
					if (
						topicIdx1 !== -1 &&
						subtopicIdx1 !== -1 &&
						topicIdx2 !== -1 &&
						subtopicIdx2 !== -1 &&
						reduceVerified
					) {
						const selector = {};
						const operator = {};
						selector[
							`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
						] = -verified;
						operator.$inc = selector;
						Topic.update({ _id: topics._id }, operator).then(() => {
							res.json({ success: true, updatedQuestion: que });
						});
					} else {
						res.json({ success: true, updatedQuestion: que });
					}
				} else if (
					topicIdx1 !== -1 &&
					subtopicIdx1 !== -1 &&
					topicIdx2 !== -1 &&
					subtopicIdx2 !== -1
				) {
					const selector = {};
					const operator = {};
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.total_questions`
					] = 1;
					selector[
						`topics.${topicIdx1}.sub_topics.${subtopicIdx1}.verified_questions`
					] = -verified;
					selector[
						`topics.${topicIdx2}.sub_topics.${subtopicIdx2}.total_questions`
					] = -1;
					operator.$inc = selector;
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({ success: true, updatedQuestion: que });
					});
				} else {
					// Log error, topic/subtopic not found
					res.json({ success: true, updatedQuestion: que });
				}
			});
		});
	});
}

function verify(req, res) {
	// should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	const { id } = req.body;
	Question.findById(id).then((question) => {
		if (!question.isVerified) {
			question.isVerified = true;
			question.verifiedBy = req.payload.id;
			question.markModified('isVerified');
			question.markModified('verifiedBy');
			question.save().then(() => {
				Topic.list().then((topics) => {
					let topicIdx = -1;
					let subtopicIdx = -1;
					topics.topics.forEach((topic_, idx1) => {
						topic_.sub_topics.forEach((sub_topic_, idx2) => {
							if (sub_topic_.id == question.topicId) {
								topicIdx = idx1;
								subtopicIdx = idx2;
							}
						});
					});
					if (topicIdx !== -1 && subtopicIdx !== -1) {
						const selector = {};
						const operator = {};
						selector[
							`topics.${topicIdx}.sub_topics.${subtopicIdx}.verified_questions`
						] = 1;
						operator.$inc = selector;
						Topic.update({ _id: topics._id }, operator).then(() => {
							res.json({ success: true });
						});
					} else {
						// Log error, topic/subtopic not found
						res.json({ success: true, message: 'error' });
					}
				});
			});
		} else {
			res.json({ success: true });
		}
	});
}

function publish(req, res) {
	// should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	const { id, unpublish: unpublishRaw } = req.body;
	const unpublish = unpublishRaw === '1';
	Question.findById(id).then((question) => {
		if (
			(unpublish && question.isPublished) ||
			(!question.isPublished && question.isVerified)
		) {
			question.set('isPublished', !unpublish);
			question.markModified('isPublished');
			question.save().then(() => {
				Topic.list().then((topics) => {
					let topicIdx = -1;
					let subtopicIdx = -1;
					topics.topics.forEach((topic_, idx1) => {
						topic_.sub_topics.forEach((subTopicItem, idx2) => {
							if (subTopicItem._id.equals(question.sub_topic)) {
								topicIdx = idx1;
								subtopicIdx = idx2;
							}
						});
					});
					if (topicIdx !== -1 && subtopicIdx !== -1) {
						const selector = {};
						const operator = {};
						selector[
							`topics.${topicIdx}.sub_topics.${subtopicIdx}.published_questions`
						] = unpublish ? -1 : 1;
						operator.$inc = selector;
						Topic.update({ _id: topics._id }, operator).then(() => {
							res.json({ success: true });
						});
					} else {
						// Log error, topic/subtopic not found
						res.json({ success: true, message: 'error' });
					}
				});
			});
		} else {
			res.json({ success: true });
		}
	});
}

function removeReports(req, res) {
	// should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	const { id } = req.body;
	Question.update({ _id: id }, { $set: { reports: [] } })
		.exec()
		.then(() => {
			res.json({ success: true });
		});
}

function publishMany(req, res) {
	// should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}

	Question.searchUnpublishedQuestions(req.body.questions).then((ques) => {
		let errorFound = false;
		ques.forEach((q) => {
			// checking for error
			if (q.error) {
				errorFound = true;
				res.json(q);
			}
		});
		if (!errorFound) {
			ques.forEach((q) => {
				// publishing each question
				q.isPublished = true;
				q.markModified('isPublished');
				q.save();
			});
			res.json('done');
		}
	});
}

function searchByTag(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}

	const { tag, from_, to_ } = req.body;

	if (tag === '') {
		res.status(422).json({ error: { code: 'tag-required' } });
		return;
	}

	Question.searchByTag(tag, from_, to_).then((questions) => {
		const subtopicData = {};
		questions.forEach((question) => {
			if (subtopicData[question.sub_topic]) {
				subtopicData[question.sub_topic].count += 1;
			} else {
				subtopicData[question.sub_topic] = { count: 1, unverified: 0 };
			}
			if (!question.verifiedBy) subtopicData[question.sub_topic].unverified += 1;
		});
		const data = [];
		Object.keys(subtopicData).forEach((k) => {
			data.push({
				subTopic: k,
				count: subtopicData[k].count,
				unverified: subtopicData[k].unverified,
			});
		});
		res.json({ success: true, subtopicData: data });
	});
}

function verifyByTag(req, res) {
	const {
		payload: { role, id },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}

	const { tag, from_, to_ } = req.body;

	if (tag === '') {
		res.status(422).json({ error: { code: 'tag-required' } });
		return;
	}

	Question.verifyByTag(tag, from_, to_, id).then((m) => {
		res.json({ success: true, m });
	});
}

function randomize(req, res) {
	// should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}

	Question.find({}).then((ques) => {
		const numbers = [...Array(ques.length).keys()];
		const shuffledNumbers = shuffle(numbers);
		ques.forEach((que, idx) => {
			que.randomId = shuffledNumbers[idx];
			que.markModified('randomId');
			que.save();
		});
		res.json(shuffledNumbers);
		//     let errorFound = false;
		//     ques.forEach((q) => { // checking for error
		//         if (q.error) {
		//             errorFound = true;
		//             res.json(q);
		//         }
		//     });
		//     if (!errorFound) {
		//         ques.forEach((q) => { // publishing each question
		//             q.isPublished = true;
		//             q.markModified('isPublished');
		//             q.save();
		//         });
		//         res.json('done');
		//     }
	});
}

function createMany(req, res, next) {
	try {
		Topic.list().then((topics) => {
			const selector = {};
			const operator = {};
			const questionsJson = Object.keys(questions).map((questionKey) => {
				const q = questions[questionKey];
				let topic = '';
				const sub_topic = '';
				topics.topics.forEach((topic_, topicIdx) => {
					topic_.sub_topics.forEach((sub_topic_, subtopicIdx) => {
						if (sub_topic_.id == q.topicId) {
							topic = topic_._id;
							sub_topic = sub_topic_._id;
							if (
								!selector[
									`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
								]
							) {
								selector[
									`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
								] = 1;
							} else {
								selector[
									`topics.${topicIdx}.sub_topics.${subtopicIdx}.total_questions`
								] += 1;
							}
						}
					});
				});
				const question = {};
				question.hasEquation = q.hasEquation;
				question.isVerified = q.isVerified;
				question.hasImage = q.hasImage;
				question.level = q.level;
				question.topicId = q.topicId;
				question.topic = topic; // handle exception
				question.sub_topic = sub_topic; // handle exception
				question.tag = q.tag ? q.tag : '';

				question.solution = {
					rawContent: JSON.stringify(q.rawSolution),
				};
				question.hint = {
					rawContent: JSON.stringify(q.rawHint),
				};
				question.content = {
					rawContent: JSON.stringify(q.rawQuestion),
				};
				const { options } = q;
				const optionsArray = Object.keys(options).map((key) => {
					const isCorrect = q.answer === key;
					return {
						isCorrect,
						content: {
							rawContent: JSON.stringify(options[key].rawContent),
						},
					};
				});

				question.options = optionsArray;

				return question;
			});
			operator.$inc = selector;
			Question.insertMany(questionsJson, (err, questions) => {
				if (err) {
					next(err);
				} else {
					Topic.update({ _id: topics._id }, operator).then(() => {
						res.json({
							status: true,
							message: `${questions.length} questions added to DB.`,
						});
					});
				}
			});
		});
	} catch (e) {
		next(e);
	}
}

function getAttemptedResponse(req, res, next) {
	// dont send others reports // check if question was attempted by user.
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `questions${req.url}`,
		params: req.body,
	});
	const { qid } = req.body;
	User.get(req.payload.id).then(async (user) => {
		try {
			const attempt = await Attempt.findOne({
				user: user._id,
				question: ObjectId(qid),
			});

			if (attempt) {
				Question.getForReview(qid).then((question) => {
					// check if question exists???
					Discussion.getByQIDs(qid).then((discussion) => {
						let found = false;
						user.bookmarks.forEach((bookmark) => {
							if (bookmark.qid === question._id.toString()) found = true;
						});
						res.json({
							question: secureQuestionResponse(question),
							response: attempt.answer.data,
							discussion: discussion || {},
							bookmark: found,
						});
					});
				});
			} else if (req.payload.role === 'super') {
				Question.getForReview(qid).then((question) => {
					// check if question exists???
					Discussion.getByQID(qid).then((discussion) => {
						res.json({
							question: secureQuestionResponse(question),
							response: {},
							discussion: discussion ? secureDiscussion(discussion) : {},
							bookmark: false,
						});
					});
				});
			} else {
				res
					.status(422)
					.json({ success: false, error: { code: 'question-not-attempted' } });
			}
		} catch (e) {
			next(e);
		}
	});
}

function secureQuestionResponse(question) {
	const secureQuestionResponse_ = {};
	secureQuestionResponse_.content = question.content;
	secureQuestionResponse_.dataType = question.dataType;
	secureQuestionResponse_.hint = question.hint;
	secureQuestionResponse_.options = question.options;
	secureQuestionResponse_.multiOptions = question.multiOptions;
	secureQuestionResponse_.integerAnswer = question.integerAnswer;
	secureQuestionResponse_.range = question.range;
	secureQuestionResponse_.reports = question.reports;
	secureQuestionResponse_.solution = question.solution;
	secureQuestionResponse_.solSubmittedBy = question.solSubmittedBy;
	secureQuestionResponse_.sub_topic = question.sub_topic;
	secureQuestionResponse_.topic = question.topic;
	secureQuestionResponse_.type = question.type;
	secureQuestionResponse_.level = question.level;
	secureQuestionResponse_._id = question._id;
	try {
		secureQuestionResponse_.stats = {
			attempts: question.stats.attempts.map((attempt) => ({
				option: attempt.option,
				time: attempt.time,
			})),
			computedStats: question.stats.computedStats,
		};
	} catch (e) {
		secureQuestionResponse_.stats = {
			attempts: [],
		};
	}
	return secureQuestionResponse_;
}

function reportQuestion(req, res) {
	const { qid, r, detail } = req.body;
	const { id: uid } = req.payload;
	Question.get(qid).then((question) => {
		let index = -1;
		question.reports.forEach((report, idx) => {
			if (report.user === uid) index = idx;
		});
		if (r === -1 && index !== -1) {
			question.reports.splice(index, 1);
		} else if (r !== -1) {
			if (index !== -1) {
				question.reports[index].kind = r;
				question.reports[index].detail = detail;
			} else {
				question.reports.push({ user: uid, kind: r, detail });
			}
			const email = new Email({
				subject: 'Report',
				data: `https://admin.prepleaf.com/questions/?id=${qid}`,
			});
			email.save();
		}
		question.markModified('reports');
		question.save();
		res.json({ success: true, kind: r });
	});
}

const recalculateStats = (req, res) => {
	const {
		questionId: id,
		recalculateAll,
		limit = 20,
		skip = 0,
		level,
		minAttempts,
		visualize,
		visualizeFields, // clubbed with visualize
		sortBy,
	} = req.body;
	const query = recalculateAll === '1' || visualize ? {} : { _id: id };
	let sort;
	if (level) {
		query.level = level;
	}

	if (
		minAttempts &&
		!Number.isNaN(parseInt(minAttempts, 10)) &&
		parseInt(minAttempts, 10) > 0
	) {
		query[`stats.attempts.${parseInt(minAttempts, 10) - 1}`] = { $exists: true };
	}

	if (sortBy) {
		sort = sortBy;
	}
	const queryCallback = (searchError, questions) => {
		if (visualize === '1') {
			const dataToRespond = { count: questions.length };
			if (visualizeFields) {
				const fields = visualizeFields.split(',');
				dataToRespond.data = questions.map((question) => {
					const da = {};
					da._id = question._id;
					fields.forEach((field) => {
						da[field] = eval(`question.${field}`);
					});
					return da;
				});
			}
			res.send(visualizeFields ? dataToRespond.data : dataToRespond);
			return;
		}
		if (searchError) {
			console.error(searchError);
			res.status(500).send({ message: 'Question search failed' });
		} else if (!questions || questions.length === 0) {
			res.status({ message: 'No question(s) found for selected criteria' });
		} else {
			calculateAndUpdateStatsForQuestions(questions).then((results) => {
				let errorCount = 0;
				const updatedData = results
					.map(({ error: e, data }) => {
						if (e) {
							errorCount += 1;
							// console.error(e);
							return null;
						}
						return data;
					})
					.filter((d) => d !== null);
				res.send({
					message: `Recalculated for ${questions.length} question(s). Limit was ${limit}`,
					updatedData,
					errorCount,
				});
			});
		}
	};

	Question.find(query)
		.limit(parseInt(limit, 10))
		.skip(parseInt(skip, 10))
		.sort(sort)
		.exec(queryCallback);
};

const createAndUpdateStatistics = (req, res) => {
	Question.find({ statistics: { $exists: false } })
		.limit(1000)
		.then((questions) => {
			questions.forEach((question) => {
				QuestionStatistics.findByQuestionId(question._id).then(
					(questionStatistics) => {
						questionStatistics.updateStatistics();
					}
				);
			});
			res.json({ success: true });
		});
};

const clearCache = (req, res) => {
	const { id } = req.params;
	const key1 = `q-woc-${id}`;
	const key2 = `q-wc-${id}`;
	memoryCache.del(key1, (err1) => {
		if (err1) {
			res.send({ success: false, message: err1.message });
		} else {
			memoryCache.del(key2, (err2) => {
				if (err2) {
					res.send({ success: false, message: err2.message });
				} else {
					res.send({ success: true });
				}
			});
		}
	});
};

const convertData = (req, res) => {
	const { id } = req.params;

	Question.findById(id, { dataType: 1 }).then((question) => {
		if (question) {
			if (question.dataType === 'image') {
				question.dataType = 'text';
				question.markModified('dataType');
				question.save().then(() => {
					const key1 = `q-woc-${id}`;
					const key2 = `q-wc-${id}`;
					memoryCache.del(key1);
					memoryCache.del(key2);
					res.json({ success: true, question });
				});
			} else {
				res.json({ success: false, message: 'dataType is already text!' });
			}
		} else {
			res.json({ success: false, message: 'Question not found!' });
		}
	});
};

const updateClient = (req, res) => {
	const { question, client } = req.body;

	if (client === 'ALL') {
		Question.update({ _id: ObjectId(question) }, { $unset: { client: 1 } }).then(
			(m) => {
				if (m.n) {
					res.json({ success: true, msg: 'Client removed successfully.' });
				} else {
					res.json({ success: false, msg: 'Question not found.' });
				}
			}
		);
	} else {
		Client.findById(client).then((c) => {
			if (c) {
				Question.update(
					{ _id: ObjectId(question) },
					{ $set: { client: c._id } }
				).then((m) => {
					if (m.n) {
						res.json({ success: true, msg: 'Client updated successfully.' });
					} else {
						res.json({ success: false, msg: 'Question not found.' });
					}
				});
			} else {
				res.json({ success: false, msg: 'Client not found.' });
			}
		});
	}
};

const listTags = (req, res, next) => {
	const { duration: rawDuration } = req.query;
	const now = Date.now();
	const duration = moment
		.duration(rawDuration.number, rawDuration.unit)
		.asMilliseconds();
	// const duration = 7 * 24 * 60 * 60 * 1000;
	Question.distinct(
		'tag',
		{ createdAt: { $gte: now - duration } },
		(error, result) => {
			if (error) {
				next(new APIError(error, 500));
			} else {
				res.send(result);
			}
		}
	);
};

const setAnswers = (req, res, next) => {
	const { question: questionId, answers } = req.body;
	Question.findById(questionId)
		.select('answers type')
		.then((question) => {
			if (!question) {
				next(new APIError('Question not found', 422, true));
			} else {
				const type = newTypeMap[question.type] || question.type;
				try {
					if (type === 'MULTIPLE_CHOICE_SINGLE_CORRECT') {
						// eslint-disable-next-line new-cap
						question.set(
							'answers',
							map(answers, (option) => ObjectId(option))
						);
					} else if (type === 'MULTIPLE_CHOICE_MULTIPLE_CORRECT') {
						question.set(
							'answers',
							// eslint-disable-next-line new-cap
							map(answers, (answer) => map(answer, (option) => ObjectId(option)))
						);
					} else if (type === 'INTEGER') {
						question.set(
							'answers',
							map(answers, (answer) => {
								const parsed = parseInt(answer, 10);
								if (Number.isNaN(parsed)) {
									throw new Error('Answer should be a number');
								}
								return parsed;
							})
						);
					} else if (type === 'RANGE') {
						question.set(
							'answers',
							map(answers, (answer) => {
								const startParsed = parseFloat(get(answer, 'start'));
								const endParsed = parseFloat(get(answer, 'end'));
								if (Number.isNaN(startParsed)) {
									throw new Error(
										'Start of range should be a number(could be a Integer or a fraction)'
									);
								} else if (Number.isNaN(endParsed)) {
									throw new Error(
										'End of range should be a number(could be a Integer or a fraction)'
									);
								}
								return { start: startParsed, end: endParsed };
							})
						);
					} else {
						throw new Error(
							`Question type ${type} is not supported yet. Please report admin.`
						);
					}
					question.save((saveError) => {
						if (saveError) {
							next(new APIError(saveError, 422, true));
						} else {
							res.send({ question, message: 'Answers set successfully.' });
						}
					});
				} catch (e) {
					next(new APIError(e.message || 'Failed to parse answers', 422, true));
				}
			}
		})
		.catch(next);
};

module.exports = {
	getQuestion,
	create,
	archive,
	hideInSearch,
	createMultiCorrect,
	createInteger,
	createRange,
	createMany,
	createMTC,
	getReported,
	randomize,
	setAnswers,
	getAttemptedResponse,
	listTags,
	reportQuestion,
	getMany,
	update,
	updateMultiCorrect,
	updateInteger,
	updateRange,
	verify,
	publish,
	removeReports,
	publishMany,
	searchByTag,
	verifyByTag,
	recalculateStats,
	createAndUpdateStatistics,
	clearCache,
	convertData,
	addWithUniqueTag,
	updateClient,
};
