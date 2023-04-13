const Promise = require('bluebird');
const { isEmpty } = require('lodash');
const Session = require('./session.model').default;
const User = require('../user/user.model').default;
const Question = require('../question/question.model').default;
const QuestionStatistics = require('../question/QuestionStatistics.model');
const Practicelog = require('../log/practicelog.model');
const createSession = require('./lib/create').default;
const endSession = require('./lib/end');
const { getQuestion, getLinkedQuestionForSession } = require('../question/lib');
const { createIsSessionActiveQuery } = require('./middlewares');
const UserQuestionAttempts = require('../models/UserQuestionAttempts').default;
const Userstat = require('../user/userstat.model');
const { getCorrectOption } = require('../lib');
const {
	findQuestion,
	findActiveQuestion,
	endFlowOfAttempt,
	calculateTimeTakenInAttempt,
} = require('./utils');

const create = (req, res, next) => {
	const { id: userId } = req.payload;
	const {
		sessionParams: { filters, title, config, assessment },
	} = res.locals;
	createSession({ user: userId, filters, title, config, assessment })
		.then((session) => {
			res.locals.session = session; // eslint-disable-line no-param-reassign
			next();
		})
		.catch((error) => {
			console.error(error);
			try {
				res.status(422).send({ message: error.message, code: 'database-error' });
			} catch (e) {
				res.status(422).send({ message: 'Some error occurred', code: 'unknown' });
			}
		});
};

const addAQuestionToSession = (req, res, next) => {
	const { userAttemptedQuestions, session, user } = res.locals;
	const { id: userId } = req.payload;
	const requestReceivedAt = Date.now();
	const handleQuestion = (question) => {
		QuestionStatistics.findByQuestionId(question._id)
			.then((questionStatistics) => {
				const item = {
					question: question._id,
					level: question.level,
					subTopic: question.sub_topic,
					perfectTimeLimits: questionStatistics.perfectTimeLimits,
					startTime: Date.now(),
				};
				const activeQuestion = findActiveQuestion(session);
				const addNewAttempt = () => {
					UserQuestionAttempts.addAttempt(userId, item).then((attempt) => {
						item.attempt = attempt._id;
						session.questions.push(item);
						session.save((error) => {
							if (error) {
								res.status(500).send({
									message: 'Database error occurred while adding a question to session',
									code: 'database-error',
								});
							} else {
								session.populate(
									`questions.${session.questions.length - 1}.attempt`,
									(err) => {
										if (err) {
											res.status(500).send({
												message:
													'Database error occurred while fetching question from database',
												code: 'database-error',
											});
										} else {
											User.updateStats(
												user,
												question._id,
												'',
												question.topic,
												question.sub_topic,
												question.level,
												session._id,
												attempt._id
											);
											user.save();
											next();
										}
									}
								);
							}
						});
					});
				};
				if (activeQuestion && !session.config.prevent.reattempt) {
					endFlowOfAttempt(activeQuestion.attempt, requestReceivedAt);
					activeQuestion.attempt.save(() => {
						addNewAttempt();
						// eslint-disable-next-line no-param-reassign
						res.locals.attemptsToSend = [activeQuestion.attempt];
					});
				} else {
					addNewAttempt();
				}
			})
			.catch((error) => {
				res.status(500).send({ message: error.message, code: error.code });
			});
	};
	const fetchQuestion = () => {
		getQuestion(session, userAttemptedQuestions)
			.then((searchedQuestion) => {
				if (searchedQuestion.link && searchedQuestion.link.id) {
					getLinkedQuestionForSession(
						searchedQuestion.link.id,
						userAttemptedQuestions
					)
						.then((linkedQuestion) => {
							handleQuestion(linkedQuestion);
						})
						.catch((error) => {
							console.error(error);
							res.status(500).send({ message: 'Internal server error.' });
						});
				} else {
					handleQuestion(searchedQuestion);
				}
			})
			.catch((error) => {
				res.status(422).send({ message: error.message, code: error.code });
				try {
					if (session.questions.length === 0) {
						session.remove((err) => {
							if (err) {
								console.error(err);
							}
						});
					}
				} catch (e) {
					console.error(e);
				}
			});
	};
	try {
		const lastQuestion = session.questions[session.questions.length - 1];
		if (lastQuestion.question.link.id) {
			getLinkedQuestionForSession(
				lastQuestion.question.link.id,
				userAttemptedQuestions
			)
				.then((linkedQuestion) => {
					handleQuestion(linkedQuestion);
				})
				.catch(() => {
					fetchQuestion();
				});
		} else {
			throw new Error('not linked question');
		}
	} catch (e) {
		fetchQuestion();
	}
};

/**
 * toAttempt list is created when user has to choose select questions
 * to attempt from a number of questions before attempting
 */
const setQuestionSelectionForSession = (req, res) => {
	const { session } = res.locals;
	const { selectedQuestionsToAttempt, selectedQuestionsNotToAttempt } = req.body;
	session.selectedQuestionsToAttempt = selectedQuestionsToAttempt;
	session.selectedQuestionsNotToAttempt = selectedQuestionsNotToAttempt;
	session.save((error) => {
		if (error) {
			res.status(422).send({
				message: 'Error occurred while saving attempt list',
				errorMessage: error.message,
			});
		} else {
			res.send({
				selectedQuestionsToAttempt: session.selectedQuestionsToAttempt,
				selectedQuestionsNotToAttempt: session.selectedQuestionsNotToAttempt,
			});
		}
	});
};

const getPropertiesToUpdate = ({
	session,
	skip,
	question,
	answer,
	questionIndex,
	statistics,
}) => {
	const propertiesToUpdate = {};
	// eslint-disable-next-line eqeqeq
	if (skip == '1' || !answer) {
		propertiesToUpdate.isSkipped = true;
	}
	if (propertiesToUpdate.isSkipped !== true) {
		propertiesToUpdate.isAnswered = true;
		propertiesToUpdate.isSkipped = false;

		if (
			question.type === 'MULTIPLE_CHOICE_SINGLE_CORRECT' ||
			question.type === 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT'
		) {
			propertiesToUpdate.answer = {
				type: 'option',
				data: answer,
			};
			if (session.config.prevent.reattempt) {
				let isCorrect = false;
				let isOptionPresent = false;
				question.options.forEach((option) => {
					if (option._id.toString() === answer) {
						isOptionPresent = true;
					}
					if (option.isCorrect) {
						if (option._id.toString() === answer) {
							isCorrect = true;
						}
					}
				});
				propertiesToUpdate.isCorrect = isCorrect;
				if (!isOptionPresent) {
					throw new Error('Invalid option');
				}
			}
		} else {
			throw new Error('Unhandled question type');
		}
	}

	const startTime = new Date(session.questions[questionIndex].attempt.startTime);
	const endTime = new Date();

	propertiesToUpdate.time = parseInt(
		(endTime.getTime() - startTime.getTime()) / 1000,
		10
	);

	propertiesToUpdate.endTime = endTime;

	propertiesToUpdate.perfectTimeLimits = statistics.perfectTimeLimits;
	let speed = 5;
	if (propertiesToUpdate.time < propertiesToUpdate.perfectTimeLimits.min) {
		speed = 10;
	} else if (
		propertiesToUpdate.time >= propertiesToUpdate.perfectTimeLimits.max
	) {
		speed = 0;
	}
	propertiesToUpdate.speed = speed;
	return propertiesToUpdate;
};

const updateOptionVotes = (question, optionIdMap) => {
	Object.keys(optionIdMap).forEach((key) => {
		question.options[optionIdMap[key]].votes = 0;
	});

	question.stats.attempts.forEach((a) => {
		if (optionIdMap[a.option] && question.options[optionIdMap[a.option]]) {
			question.options[optionIdMap[a.option]].votes += 1;
		}
	});

	return question.options;
};

const checkForReview = (question, optionIdMap) => {
	let cv = 0;
	let biv = 0;
	let tv = 0;
	Object.keys(optionIdMap).forEach((key) => {
		if (question.options[optionIdMap[key]].isCorrect) {
			cv = question.options[optionIdMap[key]].votes;
		} else {
			biv = Math.max(biv, question.options[optionIdMap[key]].votes);
		}
		tv += 1;
	});

	let isReviewable = false;
	if ((1.0 * (5 + cv)) / (5 + tv) < (1.0 * biv) / (5 + tv) + 0.2) {
		if (!question.totalReviews) {
			isReviewable = true;
		}
	}
	return isReviewable;
};

const getOptionIdMap = (question) => {
	const optionIdMap = {};
	question.options.forEach((o, idx) => {
		optionIdMap[o._id.toString()] = idx;
	});
	return optionIdMap;
};

const setActiveQuestion = (req, res) => {
	const { session } = res.locals;
	const { questionId } = req.body;
	const activeQuestion = findActiveQuestion(session);
	const requestReceivedAt = Date.now();
	if (activeQuestion) {
		if (activeQuestion.question.equals(questionId)) {
			res.send({ message: 'This question is already active', attempts: [] });
		} else {
			const { attempt: activeAttempt } = activeQuestion;
			endFlowOfAttempt(activeAttempt, requestReceivedAt);
			activeAttempt.save();

			const { attempt } = findQuestion(session, questionId);
			if (attempt) {
				if (!Array.isArray(attempt.flow)) {
					attempt.flow = [];
				}
				attempt.flow.push({ startTime: requestReceivedAt });
				attempt.save((saveError) => {
					if (saveError) {
						res.status(422).send({
							message: saveError.message,
							source: 'setActiveQuestion>if(activeQuestion)>attempt>attempt.save',
							problem: `prev active attempt: ${activeAttempt._id}, attempt to set active:${attempt._id}`,
						});
					} else {
						res.send({
							message: 'question changed',
							attempts: [activeAttempt.toObject(), attempt.toObject()],
							activeAttempt: activeAttempt.toObject(),
							activeAttemptTime: calculateTimeTakenInAttempt(activeAttempt),
							attempt: attempt.toObject(),
							currentTime: Date.now(),
						});
					}
				});
			} else {
				res.status(422).send({ message: 'Question not found in this session.' });
			}
		}
	} else {
		res
			.status(422)
			.send({ message: 'There is no active question in this session.' });
	}
};

const saveAnswer = (req, res) => {
	const { session } = res.locals;
	const { answer, questionId } = req.body;
	const { attempt, question } = findQuestion(session, questionId);
	if (
		question.type === 'MULTIPLE_CHOICE_SINGLE_CORRECT' ||
		question.type === 'LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT'
	) {
		attempt.answer = {
			type: 'option',
			data: answer,
		};
		if (!attempt.answerSelectionFlow) {
			attempt.answerSelectionFlow = [];
		}
		attempt.answerSelectionFlow.push(Object.assign({}, attempt.answer));
		attempt.save((error) => {
			if (error) {
				res.status(500).send({ message: 'Internal server error' });
			} else {
				res.send({ attempt, currentTime: Date.now() });
			}
		});
	} else {
		res.status(422).send({ message: 'Unhandled question type.' });
	}
};

const answerQuestion = (req, res) => {
	// handle skip here
	// what if user already attempted that question, in another session.
	// what is user sent an optionId, which is not part of question!?
	const { session, user } = res.locals;
	const { skip, answer, questionId } = req.body;
	const { client } = req.query;

	const { question, attempt, statistics, questionIndex } = findQuestion(
		session,
		questionId
	);

	if (!question) {
		res.status(422).send({ message: 'Question not found in this session' });
	} else {
		let propertiesToUpdate;
		try {
			propertiesToUpdate = getPropertiesToUpdate({
				session,
				skip,
				question,
				answer,
				statistics,
				questionIndex,
			});
		} catch (e) {
			res.status(500).send({ message: e.message });
			return;
		}

		/*
			New Addition: Concept thing!
		*/

		const c = question.concepts;
		if (c.length === 1) {
			Userstat.findOne({ user: user._id }).then((userstat) => {
				if (userstat) {
					let idx = -1;
					userstat.concepts.forEach((cc, i) => {
						if (cc.id.toString() == c[0].concept.toString()) {
							idx = i;
						}
					});
					if (idx === -1) {
						userstat.concepts.push({
							id: c[0].concept,
							total: 1,
							correct: propertiesToUpdate.isCorrect ? 1 : 0,
						});
					} else {
						userstat.concepts[idx].total += 1;
						userstat.concepts[idx].correct += propertiesToUpdate.isCorrect ? 1 : 0;
					}
					userstat.markModified('concepts');
					userstat.save();
				} else {
					const userstat_ = new Userstat({
						user: user._id,
						concepts: [
							{
								id: c[0].concept,
								total: 1,
								correct: propertiesToUpdate.isCorrect ? 1 : 0,
							},
						],
					});
					userstat_.save().then(() => {
						//
					});
				}
			});
		}

		// here **********

		const optionIdMap = getOptionIdMap(question);

		const optionVotes = updateOptionVotes(question, optionIdMap);
		optionVotes.forEach((o, idx) => {
			question.options[idx].votes = o.votes;
		});

		const isReviewable = checkForReview(question, optionIdMap);

		const correctOption = getCorrectOption(question.options);

		question.markModified('options');
		if (isReviewable) {
			question.set('isReviewable', true);
			question.markModified('isReviewable');
		}
		question.save();

		let xpEarned = 0;
		let streak;
		attempt.set('answer', propertiesToUpdate.answer);
		if (session.config.prevent.reattempt) {
			xpEarned = User.updateXP(user, propertiesToUpdate.isCorrect, attempt._id)
				.xpEarned;
			try {
				Practicelog.create({
					user: req.payload.id,
					question: questionId,
					marked: answer,
					correct: correctOption._id,
					streak: user.streak.day,
					xp: xpEarned,
					time: attempt.time, // add time here!!
					attemptedAt: new Date(),
				});
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error(e);
			}
			attempt.set('isAnswered', propertiesToUpdate.isAnswered);
			attempt.set('isSkipped', propertiesToUpdate.isSkipped);
			attempt.set('endTime', propertiesToUpdate.endTime);
			attempt.set('speed', propertiesToUpdate.speed);
			attempt.set('isCorrect', propertiesToUpdate.isCorrect);
			attempt.set('xpEarned', xpEarned);
			attempt.set('time', propertiesToUpdate.time);
			if (Array.isArray(attempt.flow) && attempt.flow.length) {
				attempt.flow[attempt.flow.length - 1].endTime = propertiesToUpdate.endTime;
			}
		}

		attempt.save((attemptSaveError) => {
			if (attemptSaveError) {
				console.error(attemptSaveError);
				res.status(500).send({ message: 'Unable to update attempt data' });
			} else {
				session.markModified('questions');
				session.set('xpEarned', session.xpEarned + xpEarned);
				session.save((error) => {
					if (error) {
						res
							.status(422)
							.send({ message: 'Failed to save answer', m: error.message });
					} else if (session.config.prevent.reattempt) {
						const sessionQuestion = session.questions[questionIndex].toJSON();
						res.send({
							xpEarned,
							streak,
							// stats: secureUserStats(stats),
							message: 'Answer submitted successfully',
							question: {
								core: {
									solution: question.solution,
									options: question.getOptions,
								},
								sessionSpecific: Object.assign(
									{},
									session.questions[questionIndex].toJSON(),
									{
										question:
											client === 'MAAN'
												? question._id
												: { _id: question._id, concepts: question.concepts },
										attempt: Object.assign({}, sessionQuestion.attempt, {
											question: sessionQuestion.attempt.question._id,
										}),
									}
								),
							},
							currentTime: Date.now(),
						});
					} else {
						res.send({
							question: {
								sessionSpecific: Object.assign(
									{},
									session.questions[questionIndex].toJSON(),
									{ question: question._id }
								),
							},
						});
					}
				});
			}
		});
	}
};

const getQuestionAtPosition = (req, res) => {
	const requestReceivedAt = Date.now();
	const { session, attemptsToSend } = res.locals;
	const { client } = req.query;
	const sessionInfoRequired = req.query.si === '1';
	const position =
		req.query.position === 'last' || isEmpty(req.query.position)
			? session.questions.length - 1
			: parseInt(req.query.position, 10);
	if (!(position > -1)) {
		// either there are no questions or position isNaN
		res.status(422).send({ message: 'Invalid params' });
		return;
	}
	const questionProps = session.questions[position];

	if (!questionProps) {
		res.status(422).send({ message: 'Invalid index required', code: 'unknown' });
	} else {
		let select =
			'type level content options.content options._id concepts topic link sub_topic dataType';
		if (questionProps.attempt.isAnswered || session.hasEnded) {
			select += ' options.isCorrect solution';
		}
		Question.findById(questionProps.question)
			.select(select)
			.exec((error, question) => {
				if (error) {
					res.status(500).send({
						message: 'Error occurred while searching for question',
						code: 'database-error',
					});
				} else if (!question) {
					res.status(500).send({
						message: 'Internal server error. Unable to find question',
						code: 'database-error',
					});
				} else {
					question.fixContent();

					const response = {
						question: {
							core: Object.assign({}, question.toObject(), {
								options: question.getOptions,
							}),
							sessionSpecific: Object.assign({}, questionProps.toObject(), {
								question:
									client === 'MAAN'
										? questionProps.question
										: { _id: questionProps.question, concepts: question.concepts },
							}),
						},
						currentTime: Date.now(),
					};
					if (sessionInfoRequired) {
						response.session = Object.assign(
							{},
							session.toObject({ minimize: false }),
							{ concepts: question.concepts }
						);
					}
					if (attemptsToSend) {
						response.attempts = attemptsToSend;
					}
					const activeQuestion = findActiveQuestion(session);
					if (activeQuestion && !session.config.prevent.reattempt) {
						if (activeQuestion.question._id.equals(questionProps.question._id)) {
							res.send(response);
						} else {
							endFlowOfAttempt(activeQuestion.attempt, requestReceivedAt);
							activeQuestion.attempt.save(() => {
								questionProps.attempt.flow.push({ startTime: Date.now() });
								questionProps.attempt.save((_e, a) => {
									response.question.sessionSpecific.attempt = a.toObject();
									res.send(response);
								});
							});
						}
					} else {
						res.send(response);
					}
				}
			});
	}
};

const end = (req, res) => {
	const { session } = res.locals;
	const { id: userId } = req.payload;
	endSession(session, userId).then((data) => {
		if (data.errorCode) {
			res.status(500).send({
				message: data.message,
			});
		} else {
			res.send({
				session: data.session,
				message: data.message,
				userXp: data.userXp,
				m: data.m,
			});
		}
	});
};

const endAllActive = (req, res) => {
	const { id: userId } = req.payload;
	Session.find(createIsSessionActiveQuery(userId)).exec(
		(searchError, sessions) => {
			if (searchError) {
				res.status(500).send({ message: 'Unable to search session to close' });
			} else {
				Promise.all(
					sessions.map(
						(session) =>
							new Promise((resolve, reject) => {
								session.set('hasEnded', true);
								session.set('endTime', Date.now());
								// TODO: if Date.now() is too large than last question.startTime, then
								// set endTime accordingly
								session.save((saveError) => {
									if (!saveError) {
										resolve();
									} else {
										reject(saveError);
									}
								});
							})
					)
				)
					.then(() => {
						res.send({
							message: `Ended active session${sessions.length > 1 ? 's' : ''}`,
							number: sessions.length,
							first: sessions[0],
						});
					})
					.catch(() => {
						res.status(500).send({ message: 'Error occurred while ending sessions' });
					});
			}
		}
	);
};

const updateNote = (req, res) => {
	const { session } = res.locals;
	const { data } = req.body;
	session.note.data = data;
	session.note.updatedAt = Date.now();
	session.save((error) => {
		if (error) {
			res.status(500).send({ message: 'Failed to update note' });
		} else {
			res.send({ session: { note: session.note } });
		}
	});
};

const bookmarkQuestion = (req, res) => {
	const { user, session } = res.locals;
	const { questionId } = req.body;
	let questionIndexInSession = -1;
	session.questions.forEach((questionItem, questionIndex) => {
		if (questionItem.question.equals(questionId)) {
			questionIndexInSession = questionIndex;
			session.questions[questionIndex].isBookmarked = true;
		}
	});
	if (questionIndexInSession === -1) {
		res
			.status(422)
			.send({ success: false, message: 'Question not from this session' });
		return;
	}
	Question.findById(questionId).exec((searchError, question) => {
		if (searchError) {
			res.status(500).send({
				success: false,
				message: 'Internal server error occurred while searching for question',
			});
		} else if (!question) {
			res.status(422).send({ success: false, message: 'Invalid question id' });
		} else {
			user.bookmarks.push({
				qid: questionId,
				sid: session._id,
				content: question.content,
				date: new Date(),
				topic: question.topic,
				sub_topic: question.sub_topic,
			});
			user.save((error) => {
				if (error) {
					res.status(500).send({
						success: false,
						message: 'Database error occurred while saving bookmark',
					});
				} else {
					session.save((sessionSaveError) => {
						if (sessionSaveError) {
							res.status(500).send({
								success: false,
								message: 'Failed to bookmark a question in session',
							});
						} else {
							res.send({
								success: true,
								isBookmarked: true,
								session: { questions: session.questions },
							});
						}
					});
				}
			});
		}
	});
};

const removeBookmark = (req, res) => {
	const { user, session } = res.locals;
	const { questionId } = req.body;
	let foundAtIndex = -1;
	user.bookmarks.forEach((bookmark, index) => {
		if (bookmark.qid === questionId) {
			foundAtIndex = index;
		}
	});
	let questionIndexInSession = -1;
	session.questions.forEach((questionItem, questionIndex) => {
		if (questionItem.question.equals(questionId)) {
			questionIndexInSession = questionIndex;
			session.questions[questionIndex].isBookmarked = false;
		}
	});
	if (foundAtIndex > -1 && questionIndexInSession > -1) {
		user.bookmarks.splice(foundAtIndex, 1);
		user.markModified('bookmarks');
		user.save((error) => {
			if (error) {
				res.status({
					success: false,
					message: 'Database error occurred while removing bookmark',
				});
			} else {
				session.save((sessionSaveError) => {
					if (sessionSaveError) {
						res.status(500).send({
							success: false,
							message: 'Failed to remove bookmark in session',
						});
					} else {
						setTimeout(() => {
							res.send({ success: true, isBookmarked: false });
						}, 200);
					}
				});
			}
		});
	} else {
		res.send({
			success: true,
			isBookmarked: false,
			message: 'Not found in bookmark',
			foundAtIndex,
			questionIndexInSession,
		});
	}
};

const getList = (req, res) => {
	const { id: userId } = req.payload;
	Session.find({ user: userId })
		.populate('questions.attempt')
		.sort({ createdAt: 'desc' })
		.exec((searchError, sessions) => {
			if (searchError) {
				res.status(500).send({
					message: 'Unable to fetch sessions from database',
					code: 'database-error',
				});
			} else if (req.query.client === 'MAAN') {
				res.send(sessions);
			} else {
				res.send({ items: sessions });
			}
		});
};

const get = (req, res) => {
	const { id: userId } = req.payload;
	const { si } = req.query;
	Session.findById(si)
		.populate('questions.attempt')
		.exec((searchError, session) => {
			if (searchError) {
				res.status(500).send({
					message: 'Database error occurred while searching for session by id',
					code: 'database-error',
				});
			} else if (!session || !session.user.equals(userId)) {
				res.status(422).send({ message: 'Session not found.', code: '404' });
			} else {
				res.send({ session });
			}
		});
};

module.exports = {
	addAQuestionToSession,
	answerQuestion,
	bookmarkQuestion,
	create,
	end,
	endAllActive,
	get,
	getList,
	getQuestionAtPosition,
	removeBookmark,
	saveAnswer,
	setActiveQuestion,
	setQuestionSelectionForSession,
	updateNote,
};
