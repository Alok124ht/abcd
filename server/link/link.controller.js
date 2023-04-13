const { ObjectId } = require('mongodb');
const async = require('async');
const { get } = require('lodash');
const Link = require('./link.model');
const Question = require('../question/question.model').default;
const Client = require('../client/client.model').default;
const QuestionStatistics = require('../question/QuestionStatistics.model');
const Topic = require('../topic/topic.model').default;
const cacheManager = require('../cache/cache-manager');
const { getSubTopicForId, getTopicForSubTopicId } = require('../topic/utils');

const cache = cacheManager({});

function checkLinks(questions) {
	let errorFound = false;
	questions.forEach((q) => {
		let answerFound = false;
		if (q.type === 'LINKED_RANGE') {
			if (q.range.start !== '' && q.range.end !== '') {
				answerFound = true;
			}
		} else if (q.type === 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT') {
			q.multiOptions.forEach((o) => {
				if (o.isCorrect) answerFound = true;
			});
		} else {
			q.options.forEach((o) => {
				if (o.isCorrect) answerFound = true;
			});
		}

		if (!answerFound) errorFound = true;
	});
	return errorFound;
}

async function createLink(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { client } = res.locals;

	const { link, questions } = req.body;
	const errorFound = checkLinks(questions);
	if (errorFound) {
		res.status(422).json({ success: false, error: { code: 'anwer-not-found' } });
	} else {
		const linkSubTopic = await Topic.getSubTopicForId(
			link.subTopic || get(questions, [0, 'sub_topic'])
		);
		const linkData = {
			total_questions: questions.length,
			topicId: linkSubTopic.id,
			subTopic: linkSubTopic._id,
			tag: link.tag,
			level: link.level,
			content: { rawContent: JSON.stringify(link.content.rawContent) },
		};

		if (client) {
			linkData.client = client._id;
		}

		const link_ = new Link(linkData);
		const topics = await Topic.list();
		link_.save().then((savedLink) => {
			const questions_ = questions.map((rawQuestion, idx) => {
				const subTopicDocument = getSubTopicForId(topics, rawQuestion.sub_topic);
				const topicDocument = getTopicForSubTopicId(topics, rawQuestion.sub_topic);
				topics.topics.forEach((topic_) => {
					topic_.sub_topics.forEach((subTopicItem) => {
						if (subTopicItem._id === subTopicDocument._id) {
							subTopicItem.total_questions += questions.length;
						}
					});
				});
				const question = {
					hasEquation: rawQuestion.hasEquation,
					isVerified: rawQuestion.isVerified,
					hasImage: rawQuestion.hasImage,
					level: rawQuestion.level,
					topicId: subTopicDocument.id,
					topic: topicDocument._id,
					sub_topic: subTopicDocument._id,
					tag: link.tag,
					solution: { rawContent: JSON.stringify(rawQuestion.solution.rawContent) },
					hint: { rawContent: JSON.stringify(rawQuestion.hint.rawContent) },
					content: { rawContent: JSON.stringify(rawQuestion.content.rawContent) },
					type: rawQuestion.type,
					link: {
						content: { rawContent: JSON.stringify(link.content.rawContent) },
						id: savedLink._id,
						sequence_no: idx,
						total_questions: questions.length,
					},
				};
				if (client) {
					question.client = client._id;
				}
				if (rawQuestion.type === 'LINKED_RANGE') {
					question.range = rawQuestion.range;
				} else if (rawQuestion.type === 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT') {
					const multiOptionsArray = rawQuestion.multiOptions.map((o) => ({
						isCorrect: o.isCorrect,
						content: { rawContent: JSON.stringify(o.content.rawContent) },
					}));
					question.multiOptions = multiOptionsArray;
				} else {
					const optionsArray = rawQuestion.options.map((o) => ({
						isCorrect: o.isCorrect,
						content: { rawContent: JSON.stringify(o.content.rawContent) },
					}));
					question.options = optionsArray;
				}
				return question;
			});
			Question.insertMany(questions_).then((questions__) => {
				topics.markModified('topics');
				topics.save();
				savedLink.questions = questions__.map((q) => q._id);
				savedLink.markModified('questions');
				savedLink.save();

				questions__.forEach((q) => {
					QuestionStatistics.findByQuestionId(q._id);
				});

				res.json({ success: true, questions__, questions_, savedLink });
			});
		});
	}
}

function matchOptionIds(options1, options2) {
	if (!options1 || !options2) return false;
	if (options1.length !== options2.length) return false;
	for (let i = 0; i < options1.length; i += 1) {
		if (options1[i]._id.toString() !== options2[i]._id.toString()) return false;
	}
	return true;
}

function updateLink(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}

	const { _id, link, questions } = req.body;

	const questionIds = questions.map((q) => q._id);

	Question.getManyByIds(questionIds).then(async (oQuestions) => {
		const questionMap = {};
		oQuestions.forEach((oQ) => {
			questionMap[oQ._id.toString()] = oQ;
		});

		let returnFlag = false;
		questions.forEach((question) => {
			if (!question._id || !questionMap[question._id]) {
				returnFlag = true;
			} else if (question.type === 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT') {
				if (!matchOptionIds(question.options, questionMap[question._id].options)) {
					returnFlag = true;
				}
			} else if (question.type === 'LINKED_RANGE') {
				// do nothing
			} else if (question.type === 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT') {
				if (
					!matchOptionIds(
						question.multiOptions,
						questionMap[question._id].multiOptions
					)
				) {
					returnFlag = true;
				}
			} else {
				returnFlag = true;
			}
		});
		if (returnFlag) {
			res.json({ success: false, returnFlag });
			return;
		}
		const subTopicDocument = await Topic.getSubTopicForSubTopicNumericId(
			link.topicId
		);
		const topicDocument = await Topic.getTopicForSubTopicNumericId(link.topicId);
		const topic = topicDocument ? topicDocument._id.toString() : '';
		const subTopic = subTopicDocument ? subTopicDocument._id.toString() : '';

		Link.findById(_id).then((link_) => {
			if (link_) {
				link_.total_questions = questions.length;
				link_.topicId = link.topicId;
				link.subTopic = subTopic;
				link_.tag = link.tag;
				link_.level = link.level;
				link_.content = { rawContent: JSON.stringify(link.content.rawContent) };
				link_.markModified('total_questions');
				link_.markModified('topicId');
				link_.markModified('tag');
				link_.markModified('level');
				link_.markModified('content');

				const newQuestionsIdx = [];

				questions.forEach(async (q, idx) => {
					const q_ = questionMap[q._id];

					if (q_.type === 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT') {
						q_.options.forEach((o, oidx) => {
							o.isCorrect = q.options[oidx].isCorrect;
							if (q.dataType !== 'image') {
								o.content = {
									rawContent: JSON.stringify(q.options[oidx].content.rawContent),
								};
							}
						});
						q_.markModified('options');
					} else if (q.type === 'LINKED_RANGE') {
						q_.range = { start: q.range.start, end: q.range.end };
						q_.markModified('range');
					} else if (q_.type === 'LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT') {
						q_.multiOptions.forEach((o, oidx) => {
							o.isCorrect = q.multiOptions[oidx].isCorrect;
							if (q.dataType !== 'image') {
								o.content = {
									rawContent: JSON.stringify(q.multiOptions[oidx].content.rawContent),
								};
							}
						});
						q_.markModified('multiOptions');
					}
					if (q.sub_topic) {
						const questionSubTopic = await Topic.getSubTopicForId(q.sub_topic);
						const questionTopic = await Topic.getTopicForSubTopicId(q.sub_topic);
						q_.topic = questionTopic ? questionTopic._id : topic;
						q_.sub_topic = questionSubTopic ? questionSubTopic._id : subTopic;
						q_.topicId = questionSubTopic ? questionSubTopic.id : link.topicId;
					} else {
						q_.topicId = link.topicId;
						q_.topic = topic;
						q_.sub_topic = subTopic;
					}

					q_.level = q.level;
					q_.hasEquation = q.hasEquation; // these are useless
					q_.isVerified = q.isVerified;
					q_.hasImage = q.hasImage; // these are useless
					q_.tag = link.tag;
					q_.solution = { rawContent: JSON.stringify(q.solution.rawContent) };
					q_.hint = { rawContent: JSON.stringify(q.hint.rawContent) };
					q_.content = { rawContent: JSON.stringify(q.content.rawContent) };

					q_.dataType = q.dataType ? q.dataType : 'text';
					q_.link = {
						content: { rawContent: JSON.stringify(link.content.rawContent) },
						id: _id,
						sequence_no: idx,
						total_questions: questions.length,
					};
					q_.markModified('hasEquation');
					q_.markModified('isVerified');
					q_.markModified('hasImage');
					q_.markModified('level');
					q_.markModified('topicId');
					q_.markModified('topic');
					q_.markModified('sub_topic');
					q_.markModified('tag');
					q_.markModified('solution');
					q_.markModified('hint');
					q_.markModified('content');
					q_.markModified('type');
					q_.markModified('dataType');
					q_.markModified('link');
					q_.save();
					newQuestionsIdx.push({ new: false, id: q._id });
				});
				res.json({ success: true });
			} else {
				res.json({ success: false });
			}
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
	const { questions } = req.body;

	// console.log('check ids', questions)

	questions.forEach((q) => {
		Question.findById(q).then((q_) => {
			// use update many!
			if (!q_.verifiedBy) {
				q_.verifiedBy = req.payload.id;
				q_.markModified('verifiedBy');
				q_.save();
			}
		});
	});

	res.json({ success: true });
}

function publish(req, res) {
	// should we reset stats of question is updated???
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	const { questions } = req.body;

	// console.log('check ids', questions)

	questions.forEach((q) => {
		Question.findById(q).then((q_) => {
			// use update many
			if (!q_.isPublished) {
				q_.isPublished = true;
				q_.markModified('isPublished');
				q_.save();
			}
		});
	});

	res.json({ success: true });
}

function fixLinkIds(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	Question.find({ 'link.id': { $exists: true } }).then((questions) => {
		questions.forEach((q) => {
			q.link.id = ObjectId(q.link.id);
			q.markModified('link.id');
			q.save();
		});
		res.json({ success: true, l: questions.length });
	});
}

function fixLinks(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.status(422).json({ error: { code: 'not-enough-privilege' } });
		return;
	}
	Link.find({}).then((links) => {
		links.forEach((link) => {
			Question.find({ 'link.id': link._id }).then((questions) => {
				if (link.questions.length === questions.length) {
					let totalLinks = 0;
					let error = false;
					questions.forEach((q) => {
						if (q.link.sequence_no === 0) totalLinks += 1;
						if (q.link.total_questions !== link.total_questions) error = true;
					});
					if (totalLinks === 2 || error) {
						link.questions.forEach((q, idx) => {
							Question.update(
								{ _id: q },
								{
									$set: {
										'link.sequence_no': idx,
										'link.total_questions': link.total_questions,
									},
								}
							).exec();
						});
					}
				}
			});
		});
		res.json({ success: true, links: links.length });
	});
}

const clearCache = (req, res) => {
	const { id } = req.params;

	Link.findById(id)
		.then((link) => {
			if (link) {
				const asyncfunctions = link.questions.map((qId, idx) => {
					if (idx === 0) {
						return (done) => {
							const key1 = `q-woc-${qId}`;
							const key2 = `q-wc-${qId}`;
							cache.del(key1, (err1) => {
								if (err1) {
									done(null, [false]);
								} else {
									cache.del(key2, (err2) => {
										if (err2) {
											// res.send({ success: false, message: err2.message });
											done(null, [false]);
										} else {
											// res.send({ success: true });
											done(null, [true]);
										}
									});
								}
							});
						};
					}
					return (q, done) => {
						const key1 = `q-woc-${qId}`;
						const key2 = `q-wc-${qId}`;
						cache.del(key1, (err1) => {
							if (err1) {
								q.push(false);
								done(null, q);
							} else {
								cache.del(key2, (err2) => {
									if (err2) {
										q.push(false);
										done(null, q);
									} else {
										q.push(true);
										done(null, q);
									}
								});
							}
						});
					};
				});

				async.waterfall(asyncfunctions, (err, result) => {
					if (err) {
						res.json({ success: false, message: 'Error in promise' });
					} else {
						let success = true;
						result.forEach((r) => {
							success = success && r;
						});
						res.json({ success, count: result.length });
					}
				});
			} else {
				res.send({ success: false, message: 'Link not found' });
			}
		})
		.catch(() => {
			res.send({ success: false, message: 'some error' });
		});
};

const updateClient = (req, res) => {
	const { link, client } = req.body;

	if (client === 'ALL') {
		Link.findById(link).then((l) => {
			if (l) {
				const { questions } = l;
				delete l.client;
				l.markModified('client');
				l.save().then(() => {
					Question.updateMany(
						{ _id: { $in: questions } },
						{ $unset: { client: 1 } }
					).then(() => {
						res.json({ success: true, msg: 'Client removed successfully.' });
					});
				});
			} else {
				res.json({ success: false, msg: 'Link not found.' });
			}
		});
	} else {
		Client.findById(client).then((c) => {
			if (c) {
				Link.findById(link).then((l) => {
					if (l) {
						const { questions } = l;
						l.client = c._id;
						l.markModified('client');
						l.save().then(() => {
							Question.updateMany(
								{ _id: { $in: questions } },
								{ $set: { client: c._id } }
							).then(() => {
								res.json({ success: true, msg: 'Client updated successfully.' });
							});
						});
					} else {
						res.json({ success: false, msg: 'Link not found.' });
					}
				});
			} else {
				res.json({ success: false, msg: 'Client not found.' });
			}
		});
	}
};

module.exports = {
	createLink,
	updateLink,
	verify,
	publish,
	fixLinks,
	fixLinkIds,
	clearCache,
	updateClient,
};
