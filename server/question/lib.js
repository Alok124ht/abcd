const async = require('async');
const Topic = require('../topic/topic.model').default;
const TopicCache = require('../cache/Topic');
const Question = require('./question.model').default;
const Link = require('../link/link.model');
const Questionlog = require('../log/questionlog.model');
const Attempt = require('../models/Attempt').default;
const Userstat = require('../user/userstat.model');

const {
	getDataLevel,
	selectFilter,
	selectFilterNucleus,
	randomPoissonNumber,
} = require('./utils');

const getQuestionNucleus = (session, attemptedQuestions) => {
	// console.log('getting question from nucleus');
	const promise = new Promise((resolve, reject) => {
		Topic.getTopics().then((topics) => {
			const biasedDataLevel = 0; // from users experience!!! from -5 to 5
			const query = selectFilterNucleus(session);
			const adjustedMeanFactor = getDataLevel(topics, query.sub_topic) / 10;
			const adjustedDataLevel = randomPoissonNumber(10 + biasedDataLevel);
			const dataLevel = Math.round(adjustedMeanFactor * adjustedDataLevel);

			const optionalQuery = {
				attemptsCount: { $lte: dataLevel },
			};
			query._id = { $nin: attemptedQuestions };
			query.isPublished = true;
			query.isArchived = false;

			// add datalevel condition according to attempts.length, sort/filter optimally!!!
			Question.findOne(Object.assign({}, query, optionalQuery))
				.sort({ attemptsCount: 'desc' })
				.exec((searchError, question) => {
					if (searchError) {
						reject({
							message: 'Unable to search database for question',
							code: 'internal-db',
						});
					} else if (!question) {
						// try without data level restriction
						optionalQuery.attemptsCount = {
							$gte: dataLevel,
						};
						Question.findOne(Object.assign({}, query, optionalQuery))
							.sort({ attemptsCount: 'asc' })
							.exec((secondSearchError, questionOnRetry) => {
								if (secondSearchError) {
									reject({
										message: 'Unable to search database for question',
										code: 'internal-db',
									});
								} else if (!questionOnRetry) {
									const chooseFromAnyQuery = {
										$and: [
											{ _id: { $nin: attemptedQuestions } },
											{
												$or: session.filters.map((f) => {
													const q = { sub_topic: f.subTopic };
													if (f.levels && f.levels.length) {
														q.levels = { $in: f.levels };
													}
													return q;
												}),
											},
											{ isPublished: true },
										],
									};
									Question.findOne(chooseFromAnyQuery).exec(
										(searchAllError, questionOnRetryAll) => {
											if (searchAllError) {
												reject({
													message: 'Unable to search database for question',
													code: 'internal-db',
												});
											} else if (!questionOnRetryAll) {
												reject({
													message:
														'We do not have a question for the given criteria at the moment. Please try again later.',
													code: 'end-of-questions',
												});
											} else {
												const questionlog = new Questionlog({
													adjustedMeanFactor,
													adjustedDataLevel,
													dataLevel,
													attemptsCount: questionOnRetryAll.attemptsCount,
													attempt: 3,
												});
												questionlog.save();
												resolve(questionOnRetryAll);
											}
										}
									);
								} else {
									const questionlog = new Questionlog({
										adjustedMeanFactor,
										adjustedDataLevel,
										dataLevel,
										attemptsCount: questionOnRetry.attemptsCount,
										attempt: 2,
									});
									questionlog.save();
									resolve(questionOnRetry);
								}
							});
					} else {
						const questionlog = new Questionlog({
							adjustedMeanFactor,
							adjustedDataLevel,
							dataLevel,
							attemptsCount: question.attemptsCount,
							attempt: 1,
						});
						questionlog.save();
						resolve(question);
					}
				});
		});
	});
	return promise;
};

const getQuestionDemo = (session, attemptedQuestions) => {
	// console.log('getting question from nucleus');
	const promise = new Promise((resolve, reject) => {
		Topic.getTopics().then((topics) => {
			const biasedDataLevel = 0; // from users experience!!! from -5 to 5
			const query = selectFilterNucleus(session);
			const adjustedMeanFactor = getDataLevel(topics, query.sub_topic) / 10;
			const adjustedDataLevel = randomPoissonNumber(10 + biasedDataLevel);
			const dataLevel = Math.round(adjustedMeanFactor * adjustedDataLevel);

			const optionalQuery = {
				attemptsCount: { $lte: dataLevel },
			};
			query._id = { $nin: attemptedQuestions };
			query.isPublished = true;
			query.isArchived = false;
			query.fixed = true;

			// add datalevel condition according to attempts.length, sort/filter optimally!!!
			Question.findOne(Object.assign({}, query, optionalQuery))
				.sort({ attemptsCount: 'desc' })
				.exec((searchError, question) => {
					if (searchError) {
						reject({
							message: 'Unable to search database for question',
							code: 'internal-db',
						});
					} else if (!question) {
						// try without data level restriction
						// optionalQuery.attemptsCount = {

						// };

						optionalQuery.fixed = true;
						Question.findOne(Object.assign({}, query, optionalQuery))
							.sort({ attemptsCount: 'asc' })
							.exec((secondSearchError, questionOnRetry) => {
								if (secondSearchError) {
									reject({
										message: 'Unable to search database for question',
										code: 'internal-db',
									});
								} else if (!questionOnRetry) {
									const chooseFromAnyQuery = {
										$and: [
											{ _id: { $nin: attemptedQuestions }, fixed: true },
											{
												$or: session.filters.map((f) => {
													const q = { sub_topic: f.subTopic };
													if (f.levels && f.levels.length) {
														q.levels = { $in: f.levels };
													}
													return q;
												}),
											},
											{ isPublished: true },
										],
									};
									Question.findOne(chooseFromAnyQuery).exec(
										(searchAllError, questionOnRetryAll) => {
											if (searchAllError) {
												reject({
													message: 'Unable to search database for question',
													code: 'internal-db',
												});
											} else if (!questionOnRetryAll) {
												const chooseFromAnyQuery_ = {
													$and: [
														{ _id: { $nin: attemptedQuestions } },
														{
															$or: session.filters.map((f) => {
																const q = { sub_topic: f.subTopic };
																if (f.levels && f.levels.length) {
																	q.levels = { $in: f.levels };
																}
																return q;
															}),
														},
														{ isPublished: true },
													],
												};
												Question.findOne(chooseFromAnyQuery_).exec(
													(searchAllError_, questionOnRetryAll_) => {
														if (searchAllError_) {
															reject({
																message: 'Unable to search database for question',
																code: 'internal-db',
															});
														} else if (!questionOnRetryAll_) {
															// console.log('check query', chooseFromAnyQuery_);
															reject({
																message:
																	'We do not have a question for the given criteria at the moment. Please try again later.',
																code: 'end-of-questions',
															});
														} else {
															const questionlog = new Questionlog({
																adjustedMeanFactor,
																adjustedDataLevel,
																dataLevel,
																attemptsCount: questionOnRetryAll_.attemptsCount,
																attempt: 3,
															});
															questionlog.save();
															resolve(questionOnRetryAll_);
														}
													}
												);

												// reject({
												// 	message:
												// 		'We do not have a question for the given criteria at the moment. Please try again later.',
												// 	code: 'end-of-questions',
												// });
											} else {
												const questionlog = new Questionlog({
													adjustedMeanFactor,
													adjustedDataLevel,
													dataLevel,
													attemptsCount: questionOnRetryAll.attemptsCount,
													attempt: 3,
												});
												questionlog.save();
												resolve(questionOnRetryAll);
											}
										}
									);
								} else {
									const questionlog = new Questionlog({
										adjustedMeanFactor,
										adjustedDataLevel,
										dataLevel,
										attemptsCount: questionOnRetry.attemptsCount,
										attempt: 2,
									});
									questionlog.save();
									resolve(questionOnRetry);
								}
							});
					} else {
						const questionlog = new Questionlog({
							adjustedMeanFactor,
							adjustedDataLevel,
							dataLevel,
							attemptsCount: question.attemptsCount,
							attempt: 1,
						});
						questionlog.save();
						resolve(question);
					}
				});
		});
	});
	return promise;
};

const getQuestionDefault = (session, attemptedQuestions) => {
	// console.log('getting question from default');
	const promise = new Promise((resolve, reject) => {
		Topic.getTopics().then((topics) => {
			const biasedDataLevel = 0; // from users experience!!! from -5 to 5
			const filter = selectFilter(session);
			if (filter.split('+').length === 2) {
				const query = {};

				if (parseInt(filter.split('+')[1], 10) === -1) {
					query.sub_topic = filter.split('+')[0];
				} else {
					query.sub_topic = filter.split('+')[0];
					query.level = filter.split('+')[1];
				}
				const adjustedMeanFactor = getDataLevel(topics, query.sub_topic) / 10;
				const adjustedDataLevel = randomPoissonNumber(10 + biasedDataLevel);
				const dataLevel = Math.round(adjustedMeanFactor * adjustedDataLevel);

				const optionalQuery = {
					attemptsCount: { $lte: dataLevel },
					dataType: 'text',
				};
				query._id = { $nin: attemptedQuestions };
				query.isPublished = true;
				query.isArchived = { $ne: true };
				// add datalevel condition according to attempts.length, sort/filter optimally!!!
				Question.findOne(Object.assign({}, query, optionalQuery))
					.sort({ attemptsCount: 'desc' })
					.exec((searchError, question) => {
						if (searchError) {
							reject({
								message: 'Unable to search database for question',
								code: 'internal-db',
							});
						} else if (!question) {
							// try without data level restriction
							optionalQuery.attemptsCount = {
								$gte: dataLevel,
							};
							Question.findOne(Object.assign({}, query, optionalQuery))
								.sort({ attemptsCount: 'asc' })
								.exec((secondSearchError, questionOnRetry) => {
									if (secondSearchError) {
										reject({
											message: 'Unable to search database for question',
											code: 'internal-db',
										});
									} else if (!questionOnRetry) {
										const chooseFromAnyQuery = {
											$and: [
												{ _id: { $nin: attemptedQuestions } },
												{
													$or: session.filters.map((f) => {
														const q = { sub_topic: f.subTopic };
														if (f.level && f.level !== -1) {
															q.level = f.level;
														}
														return q;
													}),
												},
												{ isPublished: true },
											],
										};
										Question.findOne(chooseFromAnyQuery).exec(
											(searchAllError, questionOnRetryAll) => {
												if (searchAllError) {
													reject({
														message: 'Unable to search database for question',
														code: 'internal-db',
													});
												} else if (!questionOnRetryAll) {
													reject({
														message:
															'We do not have a question for the given criteria at the moment. Please try again later.',
														code: 'end-of-questions',
													});
												} else {
													const questionlog = new Questionlog({
														adjustedMeanFactor,
														adjustedDataLevel,
														dataLevel,
														attemptsCount: questionOnRetryAll.attemptsCount,
														attempt: 3,
													});
													questionlog.save();
													resolve(questionOnRetryAll);
												}
											}
										);
									} else {
										const questionlog = new Questionlog({
											adjustedMeanFactor,
											adjustedDataLevel,
											dataLevel,
											attemptsCount: questionOnRetry.attemptsCount,
											attempt: 2,
										});
										questionlog.save();
										resolve(questionOnRetry);
									}
								});
						} else {
							const questionlog = new Questionlog({
								adjustedMeanFactor,
								adjustedDataLevel,
								dataLevel,
								attemptsCount: question.attemptsCount,
								attempt: 1,
							});
							questionlog.save();
							resolve(question);
						}
					});
				// TODO:if there are no questions in current filter????
			} else {
				reject({
					code: 'internal-algo',
					message: 'Some error occurred in algorightm',
					filter,
					session,
				});
			}
		});
	});
	return promise;
};

const getConceptQuestion = (concepts, session, attemptedQuestions) => {
	// console.log('getting question from default');

	const asyncfunctions = concepts.map((concept, idx) => {
		const query = {};
		query['concepts.concept'] = concept;
		query._id = { $nin: attemptedQuestions };
		query.isPublished = true;
		query.isArchived = { $ne: true };
		// console.log('check query', query);
		// console.log('check idx', idx);
		if (idx === 0) {
			return function (done) {
				Question.findOne(query).then((question) => {
					if (!question) {
						done(null, null);
					} else {
						// console.log('check qqq', question);
						done(null, question);
					}
				});
			};
		}
		return function (q, done) {
			if (q) {
				done(null, q);
			} else {
				Question.findOne(query).then((question) => {
					if (!question) {
						done(null, null);
					} else {
						// console.log('check qqq', question);
						done(null, question);
					}
				});
			}
		};
	});

	// console.log('check fns', asyncfunctions);

	if (asyncfunctions.length) {
		return new Promise((resolve, reject) => {
			async.waterfall(asyncfunctions, (err, result) => {
				if (err) {
					console.log('failure!!!');
					reject({
						message:
							'We do not have a question for the given criteria at the moment. Please try again later.',
						code: 'end-of-questions',
					});
				} else if (!result) {
					console.log('failure 2!!!');
					reject({
						message:
							'We do not have a question for the given criteria at the moment. Please try again later.',
						code: 'end-of-questions',
					});
				} else {
					// console.log('success!!!', result, err);
					resolve(result);
				}
			});
		});
	} else {
		// result
		return Promise.reject({
			message:
				'We do not have a question for the given criteria at the moment. Please try again later.',
			code: 'end-of-questions',
		});
	}

	// // // // // // // //
	/*
	const promise = new Promise((resolve, reject) => {








		const query = {};
		query.concepts = { concept };
		query._id = { $nin: attemptedQuestions };
		query.isPublished = true;
		query.isArchived = { $ne: true };
		Question.findOne(Object.assign({}, query)).then((searchError, question) => {
			if (searchError) {
				reject({
					message: 'Unable to search database for question',
					code: 'internal-db',
				});
			} else if (!question) {
				// Get question of next question 
				reject({
					message: 'Not enough questions in db',
					code: 'internal-db',
				});
			} else {
				const questionlog = new Questionlog({
					adjustedMeanFactor,
					adjustedDataLevel,
					dataLevel,
					attemptsCount: question.attemptsCount,
					attempt: 1,
				});
				questionlog.save();
				resolve(question);
			}
		});
	});
	return promise;
	*/
};

const calculateScoreForAdaptivePracticeSession = (attempts) => {
	const maxScore = 1;
	const minScore = 0;
	const valueForCorrect = { 1: 1, 2: 2, 3: 3 };
	const valueForIncorrect = { 1: -3, 2: -2, 3: -1 };
	const valueForSkip = { 1: -0.2, 2: -0.3, 3: -0.5 };
	const getValueForPerformance = (attempt) => {
		if (attempt.isCorrect) {
			return valueForCorrect[attempt.question.level];
		}
		if (attempt.isSkipped) {
			return valueForSkip[attempt.question.level];
		}
		if (attempt.isCorrect === false) {
			return valueForIncorrect[attempt.question.level];
		}
		return 0;
	};
	const getPositionCofficient = (questionIndex, totalQuestion) =>
		Math.pow(0.95, totalQuestion - questionIndex - 1);
	const maximumPossibleScore = attempts.reduce(
		(accumulator, attempt, index, arr) => {
			const v =
				valueForCorrect[attempt.question.level] *
				getPositionCofficient(index, arr.length);
			return accumulator + v;
		},
		0
	);
	const minimumPossibleScore = attempts.reduce(
		(accumulator, attempt, index, arr) => {
			const v = -1 * getPositionCofficient(index, arr.length);
			return accumulator + v;
		},
		0
	);
	const actualScore = attempts.reduce((accumulator, attempt, index, arr) => {
		const v =
			getValueForPerformance(attempt) * getPositionCofficient(index, arr.length);
		return accumulator + v;
	}, 0);
	const score =
		(actualScore - minimumPossibleScore) /
		(maximumPossibleScore - minimumPossibleScore);
	if (isNaN(score)) {
		return 0.5;
	}
	// get score between minScore and maxScore
	return Math.min(Math.max(score, minScore), maxScore);
};

const getQuestionAdaptive = (session, attemptedQuestions) =>
	new Promise((resolve, reject) => {
		Attempt.find({
			_id: { $in: session.questions.map((q) => q.attempt._id) },
		})
			.populate({ path: 'question', select: 'level' })
			.exec((error, attempts) => {
				if (error) {
					reject({ message: 'Error searching attempts', code: 'database-error' });
					return;
				}
				const score = calculateScoreForAdaptivePracticeSession(attempts);
				const preferredLevel = Math.round(Math.max(Math.min(score * 2, 2), 0) + 1);
				const preferredFilters = [
					{ subTopic: session.filters[0].subTopic, level: preferredLevel },
				];
				getQuestionDefault(
					Object.assign({ questions: [] }, session, { filters: preferredFilters }),
					attemptedQuestions
				)
					.then((r) => {
						resolve(r);
					})
					.catch(() => {
						getQuestionDefault(session, attemptedQuestions)
							.then(resolve)
							.catch(reject);
					});
			});
	});

const getConceptScores = (attempts) => {
	const conceptMap = {};
	let lastConcept = null;
	attempts.forEach((attempt) => {
		const {
			isAnswered,
			isCorrect,
			question: { concepts },
		} = attempt;
		if (concepts.length === 1) {
			const c = concepts[0].concept;
			lastConcept = c;
			if (!conceptMap[c]) {
				conceptMap[c] = { answered: 0, correct: 0 };
			}
			if (isAnswered) {
				conceptMap[c].answered += 1;
			}
			if (isCorrect) {
				conceptMap[c].correct += 1;
			}
		}
	});
	return { conceptMap, lastConcept };
};

function getOptimalConcept(concepts, userConcepts, questions) {
	if (!concepts || !concepts.length) {
		return Promise.resolve([]);
	}

	return Attempt.find({
		_id: { $in: questions.map((q) => q.attempt._id) },
	})
		.populate({ path: 'question', select: 'concepts' })
		.then((attempts) => {
			const { conceptMap: conceptScores, lastConcept } = getConceptScores(
				attempts
			);

			const chosenConcepts = [];
			let success = true;
			let success2 = false;
			concepts.forEach((c) => {
				// should only be for last concept!
				const cc = c.concept._id;
				if (cc && lastConcept && cc.toString() == lastConcept.toString()) {
					success2 = true;
				}

				if (!lastConcept) {
					success = false;
				} else if (success2) {
					if (!conceptScores[cc]) {
						// not possible
						success = false;
					} else if (conceptScores[cc].answered < 3) {
						success = false;
					} else if (conceptScores[cc].correct < 0.7 * conceptScores[cc].answered) {
						success = false;
					}
				}

				if (!success) {
					chosenConcepts.push(c.concept._id);
				}
			});
			return Promise.resolve(chosenConcepts);
		});
}

function getTopicIndexes(topics) {
	const topicIndexes = {};
	topics.forEach((t, i1) => {
		if (!topicIndexes[t._id]) topicIndexes[t._id] = { tIdx: i1 };
		t.sub_topics.forEach((st, i2) => {
			if (!topicIndexes[st._id]) topicIndexes[st._id] = { tIdx: i1, stIdx: i2 };
		});
	});
	return topicIndexes;
}

const getQuestionSuperAdaptive = (session, attemptedQuestions) => {
	if (session.filters.length === 1) {
		const { subTopic } = session.filters[0];
		return Userstat.find({ user: session.user._id }).then(
			(userstat) =>
				new Promise((resolve) => {
					TopicCache.get((err, topics) => {
						if (err) {
							resolve(null);
						} else if (!topics) {
							resolve(null);
						} else if (!userstat) {
							const userstat_ = new Userstat({
								user: session.user._id,
								concepts: [],
							});

							userstat_.save().then((savedUserStat) => {
								const topicIndexes = getTopicIndexes(topics.topics);

								if (topicIndexes[subTopic]) {
									const { tIdx, stIdx } = topicIndexes[subTopic];
									const { concepts } = topics.topics[tIdx].sub_topics[stIdx];

									getOptimalConcept(
										concepts,
										savedUserStat.concepts,
										session.questions
									).then((choosenConcept) => {
										resolve(
											getConceptQuestion(choosenConcept, session, attemptedQuestions)
										);
									});
								}
							});
						} else {
							const topicIndexes = getTopicIndexes(topics.topics);
							if (topicIndexes[subTopic]) {
								const { tIdx, stIdx } = topicIndexes[subTopic];
								const { concepts } = topics.topics[tIdx].sub_topics[stIdx];
								getOptimalConcept(concepts, userstat.concepts, session.questions).then(
									(choosenConcept) => {
										resolve(
											getConceptQuestion(choosenConcept, session, attemptedQuestions)
										);
									}
								);
							}
						}
					});
				})
		);
	}
	return new Promise((resolve, reject) => {
		Attempt.find({
			_id: { $in: session.questions.map((q) => q.attempt._id) },
		})
			.populate({ path: 'question', select: 'level' })
			.exec((error, attempts) => {
				if (error) {
					reject({ message: 'Error searching attempts', code: 'database-error' });
					return;
				}
				const score = calculateScoreForAdaptivePracticeSession(attempts);
				const preferredLevel = Math.round(Math.max(Math.min(score * 2, 2), 0) + 1);
				const preferredFilters = [
					{ subTopic: session.filters[0].subTopic, level: preferredLevel },
				];
				getQuestionDefault(
					{ questions: [], ...session, filters: preferredFilters },
					attemptedQuestions
				)
					.then((r) => {
						resolve(r);
					})
					.catch(() => {
						getQuestionDefault(session, attemptedQuestions)
							.then(resolve)
							.catch(reject);
					});
			});
	});
};

const selectorFunctions = {
	nucleus: getQuestionNucleus,
	demo: getQuestionDemo,
	topicAdaptive: getQuestionAdaptive,
	superAdaptive: getQuestionSuperAdaptive,
	// topicAdaptive: getQuestionSuperAdaptive,
	// superAdaptive: getQuestionAdaptive,
};

const getQuestion = (session, attemptedQuestions) => {
	// console.log('checking selector', session.config.selector);
	if (!session.config.selector || !selectorFunctions[session.config.selector]) {
		return getQuestionDefault(session, attemptedQuestions);
	}
	return selectorFunctions[session.config.selector](session, attemptedQuestions);
};

const getLinkedQuestionForSession = (linkId, attemptedQuestions) =>
	new Promise((resolve, reject) => {
		Link.findById(linkId)
			.populate('questions')
			.exec((linkSearchError, link) => {
				if (linkSearchError) {
					reject(linkSearchError);
				} else if (!link) {
					reject(new Error('Link not found'));
				} else {
					let questionToReturn = null;
					link.questions.some((question) => {
						if (!attemptedQuestions.some((q) => question._id.equals(q))) {
							questionToReturn = question;
							return true;
						}
						return false;
					});
					if (questionToReturn) {
						resolve(questionToReturn);
					} else {
						reject(new Error('No more questions for this link.'));
					}
				}
			});
	});

module.exports = {
	getQuestion,
	getLinkedQuestionForSession,
};
