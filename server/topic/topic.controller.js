const { ObjectId } = require('mongodb');
const Topic = require('./topic.model').default;
const TopicCache = require('../cache/Topic');
const TopicNote = require('./topicNote.model');
const Question = require('../question/question.model').default;
const User = require('../user/user.model').default;
const Concept = require('./concept.model');
const Log = require('../log/log.model');
const lib = require('../user/lib.js');
const cacheManager = require('../cache/cache-manager');

const memoryCache = cacheManager({});

const { filterSubscribedTopics } = lib;
const { userTopics } = lib;

function get(req, res) {
	Log.create({
		user: req.payload.id,
		role: req.payload.role,
		api: `topics${req.url}`,
		params: req.body,
	});

	const projection = {
		role: 1,
		stats: 1,
		subscriptions: 1,
	};
	User.get(req.payload.id, projection).then((user) => {
		userTopics(user).then((topicData) => {
			res.json({
				topics: topicData.topics,
			});
		});
	});
}

function createTopic(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	} else {
		const { newTopic } = req.body;
		Topic.findOne().then((topic) => {
			if (topic !== null) {
				Topic.update(
					{
						_id: topic._id,
					},
					{
						$push: {
							topics: {
								name: newTopic,
								sub_topic: [],
								average_test_performance: {},
							},
						},
					}
				).then(() => {
					memoryCache.del('x-topics');
					Topic.getTopics().then((topics) => {
						res.json({ success: true, topics });
					});
				});
			} else {
				res.json({ success: false });
			}
		});
	}
}

function createSubtopic(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	} else {
		const { newSubtopic, topicId } = req.body;
		Topic.findOne().then((topic) => {
			if (topic !== null) {
				let found = -1;
				topic.topics.forEach((t, idx) => {
					if (t._id.toString() == topicId) found = idx;
				});
				if (found !== -1) {
					let maxId = 0;
					topic.topics.forEach((t) =>
						t.sub_topics.forEach((st) => (maxId = Math.max(maxId, st.id)))
					);
					const selector = {};
					const operator = {};
					selector[`topics.${found}.sub_topics`] = {
						name: newSubtopic,
						id: maxId + 1,
						average_test_performance: {},
						total_questions: 0,
					};
					operator.$push = selector;
					Topic.update({ _id: topic._id }, operator).then(() => {
						memoryCache.del('x-topics');
						Topic.getTopics().then((topics) => res.json({ success: true, topics }));
					});
				} else {
					res.json({ success: false });
				}
			} else {
				// ???
				res.json({ success: false });
			}
		});
	}
}

function createMany(req, res, next) {
	let { topics } = req.body;
	try {
		topics = JSON.parse(topics);
	} catch (e) {
		next(e);
		return;
	}
	Topic.findOne().then((topic) => {
		if (topic === null) {
			const topic_ = new Topic({ topics });
			topic_
				.save()
				.then((savedTopic) => res.json(savedTopic))
				.catch((e) => next(e));
		}
	});
}

function commonUserCount(questions, dataLevel, concepts) {
	const userQuestionMap = {};
	const step = Math.max(1, Math.round((2 * dataLevel) / 10));
	const attemptHist = [...Array(10)].map((a, i) => {
		if (i === 9) {
			return { count: 0, binName: i * step + '+' };
		} else {
			return { count: 0, binName: i * step + ' - ' + (i + 1) * step };
		}
	});
	const conceptHist = {};
	concepts.forEach((concept) => {
		conceptHist[concept.concept._id.toString()] = {
			binName: concept.concept.name,
			count: 0,
		};
	});
	questions.forEach((q) => {
		// console.log('checking attempts...', q.attemptsCount, step, dataLevel);
		q.stats.attempts.forEach((a) => {
			// console.log('checking attempts...');
			if (a.mode === 'practice') {
				if (!userQuestionMap[a.user.toString()])
					userQuestionMap[a.user.toString()] = 1;
				else userQuestionMap[a.user.toString()] += 1;
			}
		});

		attemptHist[
			step ? Math.round(Math.max(0, Math.min(9, q.attemptsCount / step))) : 0
		].count += 1;
		q.concepts.forEach((c) => {
			if (conceptHist[c.concept.toString()] !== undefined) {
				conceptHist[c.concept.toString()].count += 1;
			}
		});
	});
	let c75 = 0;
	let c100 = 0;
	const completedBy = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	Object.keys(userQuestionMap).forEach((k) => {
		if (userQuestionMap[k] >= 0.1 * questions.length) completedBy[0] += 1;
		if (userQuestionMap[k] >= 0.2 * questions.length) completedBy[1] += 1;
		if (userQuestionMap[k] >= 0.3 * questions.length) completedBy[2] += 1;
		if (userQuestionMap[k] >= 0.4 * questions.length) completedBy[3] += 1;
		if (userQuestionMap[k] >= 0.5 * questions.length) completedBy[4] += 1;
		if (userQuestionMap[k] >= 0.6 * questions.length) completedBy[5] += 1;
		if (userQuestionMap[k] >= 0.7 * questions.length) completedBy[6] += 1;
		if (userQuestionMap[k] >= 0.8 * questions.length) completedBy[7] += 1;
		if (userQuestionMap[k] >= 0.9 * questions.length) completedBy[8] += 1;
		if (userQuestionMap[k] >= 1.0 * questions.length) completedBy[9] += 1;
	});

	return {
		completedBy,
		attemptHist,
		conceptHist: Object.keys(conceptHist).map((k) => {
			return conceptHist[k];
		}),
	};
}

function calibrateStats(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const { sub_topic } = req.body;
	Topic.list().then((topics) => {
		const subtopicMap = {};
		topics.topics.forEach((t, tIdx) => {
			t.sub_topics.forEach((st, stIdx) => {
				subtopicMap[st._id.toString()] = {
					tIdx,
					stIdx,
					dataLevel: st.dataLevel,
					concepts: st.concepts,
				};
			});
		});
		const topicIdx = subtopicMap[sub_topic] ? subtopicMap[sub_topic].tIdx : -1;
		const subTopicIdx = subtopicMap[sub_topic]
			? subtopicMap[sub_topic].stIdx
			: -1;

		// console.log('checking things', topicIdx, subTopicIdx);

		if (topicIdx !== -1 && subTopicIdx !== -1) {
			Question.find({ sub_topic, verifiedBy: { $nin: [''] } }, { _id: 1 })
				.count()
				.then((verifiedQuestions) => {
					Question.find(
						{ sub_topic, isPublished: true },
						{ _id: 1, attemptsCount: 1, stats: 1, concepts: 1 }
					)
						.exec()
						.then((publishedQuestions) => {
							Question.find({ sub_topic }, { _id: 1 })
								.count()
								.then((totalQuestions) => {
									Question.find(
										{ sub_topic, level: 1, verifiedBy: { $nin: [''] } },
										{ _id: 1 }
									)
										.count()
										.then((easyQuestions) => {
											Question.find({ sub_topic, level: 2, verifiedBy: { $nin: [''] } })
												.count()
												.then((mediumQuestions) => {
													Question.find(
														{ sub_topic, level: 3, verifiedBy: { $nin: [''] } },
														{ _id: 1 }
													)
														.count()
														.then((hardQuestions) => {
															const {
																completedBy,
																attemptHist,
																conceptHist,
															} = commonUserCount(
																publishedQuestions,
																subtopicMap[sub_topic].dataLevel,
																subtopicMap[sub_topic].concepts
															);
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].verified_questions = verifiedQuestions;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].published_questions = publishedQuestions.length;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].total_questions = totalQuestions;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].difficulty.easy = easyQuestions;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].difficulty.medium = mediumQuestions;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].difficulty.hard = hardQuestions;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].completedBy = completedBy;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].attemptHist = attemptHist;
															topics.topics[topicIdx].sub_topics[
																subTopicIdx
															].conceptHist = conceptHist;
															topics.calibrationDate = new Date();

															console.log('all good!!!', topics.calibrationDate);

															topics.markModified('topics');

															topics.save().then(() => {
																if (role !== 'super' && role !== 'admin') {
																	// for moderator?
																	User.get(req.payload.id).then((user) => {
																		filterSubscribedTopics(
																			topics.topics,
																			user.subscriptions
																		).then((subscribedTopics) => {
																			res.json({ success: true, topics: subscribedTopics });
																		});
																	});
																} else {
																	res.json({ success: true, topics: topics.topics });
																}
															});
														});
												});
										});
								});
						});
				});
		} else {
			res.json({ success: false });
		}
	});
}

function updateTag(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}
	const { sub_topic, tag } = req.body;
	Topic.list().then((topics) => {
		let topicIdx = -1;
		let subTopicIdx = -1;
		topics.topics.forEach((t, tIdx) => {
			t.sub_topics.forEach((st, stIdx) => {
				if (st._id.toString() == sub_topic) {
					topicIdx = tIdx;
					subTopicIdx = stIdx;
				}
			});
		});
		if (topicIdx !== -1 && subTopicIdx !== -1) {
			topics.topics[topicIdx].sub_topics[subTopicIdx].tag = tag;
			topics.markModified('topics');
			topics.save().then(() => {
				res.json({ success: true, topics: topics.topics });
			});
		} else {
			res.json({ success: false });
		}
	});
}

function addConcept(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const { sub_topic, concept } = req.body;
	Topic.list().then((topics) => {
		let topicIdx = -1;
		let subTopicIdx = -1;
		topics.topics.forEach((t, tIdx) => {
			t.sub_topics.forEach((st, stIdx) => {
				if (st._id.toString() == sub_topic) {
					topicIdx = tIdx;
					subTopicIdx = stIdx;
				}
			});
		});
		if (topicIdx !== -1 && subTopicIdx !== -1) {
			const concept_ = new Concept({
				name: concept,
				topic: topics.topics[topicIdx]._id.toString(),
				sub_topic: topics.topics[topicIdx].sub_topics[subTopicIdx]._id.toString(),
			});
			concept_.save().then((savedConcept) => {
				topics.topics[topicIdx].sub_topics[subTopicIdx].concepts.push({
					concept: savedConcept._id,
				});
				topics.markModified('topics');
				topics.save().then(() => {
					Topic.list().then((newtopics) => {
						res.json({ success: true, topics: newtopics.topics });
						memoryCache.del('x-topics');
					});
				});
			});
		} else {
			res.json({ success: false });
		}
	});
}

/**
 * Remove concept from topic
 * */
async function removeConcepts(req, res, next) {
	const { sub_topic: subTopic, conceptItemIds } = req.body;
	const topics = await Topic.list();
	let topicIndex = -1;
	let subTopicIndex = -1;
	topics.topics.forEach((t, tIdx) => {
		t.sub_topics.forEach((st, stIdx) => {
			if (st._id.toString() === subTopic) {
				topicIndex = tIdx;
				subTopicIndex = stIdx;
			}
		});
	});
	if (subTopicIndex !== -1 && topicIndex !== -1) {
		conceptItemIds.forEach((itemId) => {
			topics.topics[topicIndex].sub_topics[subTopicIndex].concepts.pull({
				_id: itemId,
			});
		});
		topics.markModified('topics');
		try {
			await topics.save();
			res.send({ a: topics.topics[topicIndex].sub_topics[subTopicIndex] });
			memoryCache.del('x-topics');
		} catch (e) {
			next(e);
		}
	} else {
		next(new Error('Sub Topic not found'));
	}
}

function calibrateDifficulty(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const { topic } = req.body;
	Topic.list().then((topics) => {
		Question.find({ topic, level: 1, isPublished: true })
			.exec()
			.then((easyQuestions) => {
				Question.find({ topic, level: 2, isPublished: true })
					.exec()
					.then((mediumQuestions) => {
						Question.find({ topic, level: 3, isPublished: true })
							.exec()
							.then((hardQuestions) => {
								let topicIdx = -1;
								topics.topics.forEach((t, idx) => {
									if (t._id.toString() == topic) {
										topicIdx = idx;
									}
								});

								if (topicIdx !== -1) {
									topics.topics[topicIdx].difficulty.Easy = easyQuestions.length;
									topics.topics[topicIdx].difficulty.Medium = mediumQuestions.length;
									topics.topics[topicIdx].difficulty.Hard = hardQuestions.length;
									topics.calibrationDate = new Date();
									topics.markModified('topics');
									topics.save().then(() => {
										res.json({ success: true, topics: topics.topics });
									});
								}
							});
					});
			});
	});
}

function removeTopic(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const { topic } = req.body;
	Question.count({ topic })
		.then((count) => {
			if (count) {
				res.json({ success: false, count });
			} else {
				Topic.update({}, { $pull: { topics: { _id: ObjectId(topic) } } }).then(
					() => {
						memoryCache.del('x-topics');
						TopicCache.get((err, topics) => {
							if (err) {
								res.json({ success: false });
							} else if (!topics) {
								res.json({ success: false });
							} else {
								res.json({ success: true, topics: topics.topics });
							}
						});
					}
				);
			}
		})
		.catch(() => {
			res.json({ success: false, e: 'e' });
		});
}

function removeSubtopic(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		res.json({ success: false });
		return;
	}
	const { sub_topic } = req.body;
	Question.count({ sub_topic })
		.then((count) => {
			if (count) {
				res.json({ success: false, count });
			} else {
				Topic.update(
					{ 'topics.sub_topics._id': ObjectId(sub_topic) },
					{ $pull: { 'topics.$.sub_topics': { _id: ObjectId(sub_topic) } } }
				).then((m) => {
					memoryCache.del('x-topics');
					TopicCache.get('x-topics', function (err, topics) {
						if (err) {
							res.json({ success: false });
						} else if (!topics) {
							res.json({ success: false });
						} else {
							res.json({ success: true, topics: topics.topics });
						}
					});
				});
			}
		})
		.catch(() => {
			res.json({ success: false, e: 'e' });
		});
}

function getDefaultNote(req, res) {
	const {
		payload: { id },
	} = req;
	const { subTopicId } = req.params;
	TopicNote.findOne({ subTopicId, user: id })
		.populate([{ path: 'user', select: 'username' }])
		.then((topicNote) => {
			if (topicNote) {
				res.json({ success: true, topicNote: topicNote });
			} else {
				TopicNote.findOne({ subTopicId })
					.populate([{ path: 'user', select: 'username' }])
					.then((topicNote) => {
						if (topicNote) {
							res.json({ success: true, topicNote: topicNote });
						} else {
							res.json({ success: true, topicNote: null });
						}
					});
			}
		});
}

function updateNote(req, res) {
	const {
		payload: { id: uid, role },
	} = req;
	let { preferred } = req.body;
	if (role !== 'admin' && role !== 'super') {
		preferred = false;
	}
	const { id, sid, data } = req.body;

	if (preferred) {
		//admin panel
		TopicNote.findOne({ _id: id, preferred: true })
			.populate([{ path: 'user', select: 'username' }])
			.then((topicNote) => {
				if (topicNote) {
					topicNote.note = data;
					topicNote.preferred = preferred;
					topicNote.markModified('note');
					topicNote.markModified('preferred');
					topicNote.save().then(() => {
						res.json({ success: true, topicNote });
					});
				} else {
					const topicNote_ = new TopicNote({
						subTopicId: sid,
						user: uid,
						note: data,
						preferred,
					});
					topicNote_.save().then((savedTopicNote) => {
						TopicNote.populate(
							savedTopicNote,
							{
								path: 'user',
								select: 'username',
							},
							function (err, populatedNote) {
								res.json({ success: true, topicNote: populatedNote });
							}
						);
					});
				}
			});
	} else {
		TopicNote.findOne({ _id: id, user: uid })
			.populate([{ path: 'user', select: 'username' }])
			.then((topicNote) => {
				if (topicNote) {
					topicNote.note = data;
					topicNote.markModified('note');
					topicNote.save().then(() => {
						res.json({ success: true, topicNote });
					});
				} else {
					const topicNote_ = new TopicNote({
						subTopicId: sid,
						user: uid,
						note: data,
					});
					topicNote_.save().then((savedTopicNote) => {
						TopicNote.populate(
							savedTopicNote,
							{
								path: 'user',
								select: 'username',
							},
							(err, populatedNote) => {
								res.json({ success: true, topicNote: populatedNote });
							}
						);
					});
				}
			});
	}
}

module.exports = {
	addConcept,
	get,
	createMany,
	createTopic,
	createSubtopic,
	calibrateStats,
	updateTag,
	calibrateDifficulty,
	removeTopic,
	removeSubtopic,
	getDefaultNote,
	removeConcepts,
	updateNote,
};
