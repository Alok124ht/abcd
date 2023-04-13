const TopicCache = require('../cache/Topic');
const Question = require('../question/question.model').default;
const User = require('./user.model').default;
const Client = require('../client/client.model').default;
const Referral = require('./referral.model');

function dateToday(date) {
	return `${date.getDate()}-${date.getMonth()}-${date.getFullYear()}`;
}

function calibrateUserDifficulty(user, topics) {
	const subscribedTopics = filterSubscribedTopics(topics, user.subscriptions);
	const ids = subscribedTopics.map((t) => t._id.toString());
	const solvedQuestions = [];
	user.stats.topics.forEach((t) => {
		if (ids.indexOf(t._id.toString())) {
			t.sub_topics.forEach((st) => {
				solvedQuestions.push(...st.questions.map((q) => q.qid));
			});
		}
	});
	return Question.find({
		_id: { $in: solvedQuestions },
		level: 1,
	}).then((easyQuestions) =>
		Question.find({
			_id: { $in: solvedQuestions },
			level: 2,
		}).then((mediumQuestions) =>
			Question.find({
				_id: { $in: solvedQuestions },
				level: 3,
			}).then((hardQuestions) =>
				Promise.resolve({
					Easy: easyQuestions.length,
					Medium: mediumQuestions.length,
					Hard: hardQuestions.length,
				})
			)
		)
	);
}

function filterSubscribedTopics(topics, subscriptions) {
	const groupsFound = {};
	const topicsFound = {};
	subscriptions.forEach((subscription) => {
		subscription.subgroups.forEach((sg) => {
			sg.phases.forEach((p) => {
				if (p.active) {
					if (p.phase.topics) {
						p.phase.topics.forEach((t) => {
							topicsFound[t] = true;
							groupsFound[sg.group] = true;
						});
					}
				}
			});
		});
	});
	const filteredTopics = [];
	topics.forEach((topic) => {
		if (topicsFound[topic._id.toString()]) {
			const filteredTopic = {
				_id: topic._id,
				name: topic.name,
				difficulty: {
					Easy: topic.difficulty.Easy,
					Medium: topic.difficulty.Medium,
					Hard: topic.difficulty.Hard,
				},
				sub_topics: [],
			};
			filteredTopic.sub_topics = [];
			topic.sub_topics.forEach((st) => {
				if (0 && st.availableFor && st.availableFor.length) {
					// remove this. makes everything complicated
					let found = false;
					st.availableFor.forEach((af) => {
						if (!found && groupsFound[af]) {
							found = true;

							filteredTopic.sub_topics.push(st);
						}
					});
				} else {
					filteredTopic.sub_topics.push(st);
				}
			});
			filteredTopics.push(filteredTopic);
		}
	});
	return filteredTopics;
}

function getTopicComplete(stats, topic, sub_topic) {
	if (!sub_topic.published_questions) return 0;
	let percent = 0;
	stats.forEach((t) => {
		if (t.id == topic._id.toString()) {
			t.sub_topics.forEach((s_t) => {
				if (s_t.id == sub_topic._id.toString()) {
					percent = s_t.questions.length;
					return percent;
				}
			});
		}
	});
	return percent;
}

function getSuperTopics(topics, user, puzzles) {
	let easyQuestions = 0;
	let mediumQuestions = 0;
	let hardQuestions = 0;
	let all_questions_published = 0;
	let all_questions_completed = 0;
	const filteredTopics = topics.map((topic) => {
		const sub_topics = [];
		let total_completed = 0;
		let total_published = 0;
		easyQuestions += topic.difficulty.Easy;
		mediumQuestions += topic.difficulty.Medium;
		hardQuestions += topic.difficulty.Hard;
		topic.sub_topics.forEach((st) => {
			const topic_completed_temp = Math.min(
				getTopicComplete(user.stats.topics, topic, st),
				st.published_questions
			);
			sub_topics.push({
				_id: st._id,
				id: st.id,
				name: st.name,
				difficulty: st.difficulty,
				verified_questions: st.verified_questions,
				published_questions: st.published_questions,
				completedBy: st.completedBy,
				attemptHist: st.attemptHist,
				conceptHist: st.conceptHist,
				tag: st.tag,
				concepts: st.concepts,
				total_questions: st.total_questions,
				percent_complete:
					Math.round((10000 * topic_completed_temp) / st.published_questions) / 100,
			});
			total_completed += topic_completed_temp;
			total_published += st.published_questions;
			all_questions_completed += topic_completed_temp;
			all_questions_published += st.published_questions;
		});
		return {
			_id: topic._id,
			name: topic.name,
			difficulty: topic.difficulty,
			average_test_performance: topic.average_test_performance,
			sub_topics,
			percent_complete: total_published
				? Math.round((10000 * total_completed) / total_published) / 100
				: 0,
		};
	});
	return {
		topics: filteredTopics,
		difficulty: {
			Easy: easyQuestions,
			Medium: mediumQuestions,
			Hard: hardQuestions,
		},
		puzzles,
		percentComplete: all_questions_published
			? Math.round((10000 * all_questions_completed) / all_questions_published) /
			  100
			: 0,
	};
}

function getModeratorTopics(topics, user, puzzles, client) {
	// if client is not present, no data would be sent
	let easyQuestions = 0;
	let mediumQuestions = 0;
	let hardQuestions = 0;
	let all_questions_published = 0;
	let all_questions_completed = 0;

	const cTopics = {};
	client.phases.forEach((p) => {
		p.topics.forEach((t) => {
			cTopics[t] = true;
		});
	});

	const filteredTopics = topics
		.filter((t_) => {
			if (cTopics[t_._id.toString()]) {
				return true;
			}
			return false;
		})
		.map((topic) => {
			const sub_topics = [];
			let total_completed = 0;
			let total_published = 0;
			easyQuestions += topic.difficulty.Easy;
			mediumQuestions += topic.difficulty.Medium;
			hardQuestions += topic.difficulty.Hard;
			topic.sub_topics.forEach((st) => {
				const topic_completed_temp = Math.min(
					getTopicComplete(user.stats.topics, topic, st),
					st.published_questions
				);
				sub_topics.push({
					_id: st._id,
					id: st.id,
					name: st.name,
					difficulty: st.difficulty,
					verified_questions: st.verified_questions,
					published_questions: st.published_questions,
					completedBy: st.completedBy,
					attemptHist: st.attemptHist,
					conceptHist: st.conceptHist,
					tag: st.tag,
					concepts: st.concepts,
					total_questions: st.total_questions,
					percent_complete:
						Math.round((10000 * topic_completed_temp) / st.published_questions) / 100,
				});
				total_completed += topic_completed_temp;
				total_published += st.published_questions;
				all_questions_completed += topic_completed_temp;
				all_questions_published += st.published_questions;
			});
			return {
				_id: topic._id,
				name: topic.name,
				difficulty: topic.difficulty,
				average_test_performance: topic.average_test_performance,
				sub_topics,
				percent_complete: total_published
					? Math.round((10000 * total_completed) / total_published) / 100
					: 0,
			};
		});
	return Promise.resolve({
		topics: filteredTopics,
		difficulty: {
			Easy: easyQuestions,
			Medium: mediumQuestions,
			Hard: hardQuestions,
		},
		puzzles,
		percentComplete: all_questions_published
			? Math.round((10000 * all_questions_completed) / all_questions_published) /
			  100
			: 0,
	});
}

function getUserTopics(topics, user, puzzles) {
	const subscribedTopics = filterSubscribedTopics(topics, user.subscriptions);

	let easyQuestions = 0;
	let mediumQuestions = 0;
	let hardQuestions = 0;
	let all_questions_published = 0;
	let all_questions_completed = 0;
	const filteredTopics = subscribedTopics.map((topic) => {
		const sub_topics = [];
		let total_completed = 0;
		let total_published = 0;

		easyQuestions += topic.difficulty.Easy;
		mediumQuestions += topic.difficulty.Medium;
		hardQuestions += topic.difficulty.Hard;
		topic.sub_topics.forEach((st) => {
			const topic_completed_temp = Math.min(
				getTopicComplete(user.stats.topics, topic, st),
				st.published_questions
			);
			if (st.published_questions) {
				sub_topics.push({
					_id: st._id,
					id: st.id,
					name: st.name,
					tag: st.tag,
					concepts: st.concepts,
					percent_complete:
						Math.round((10000 * topic_completed_temp) / st.published_questions) / 100,
				});
			} else {
				sub_topics.push({
					_id: st._id,
					id: st.id,
					name: st.name,
					tag: st.tag,
					concepts: st.concepts,
					hide: true,
				});
			}
			total_completed += topic_completed_temp;
			total_published += st.published_questions;
			all_questions_completed += topic_completed_temp;
			all_questions_published += st.published_questions;
		});
		return {
			_id: topic._id,
			name: topic.name,
			difficulty: topic.difficulty,
			average_test_performance: topic.average_test_performance,
			sub_topics,
			percent_complete: total_published
				? Math.round((10000 * total_completed) / total_published) / 100
				: 0,
		};
	});
	const percentComplete =
		Math.max(
			0,
			Math.round((10000 * all_questions_completed) / all_questions_published)
		) / 100;
	return {
		topics: filteredTopics,
		difficulty: {
			Easy: easyQuestions,
			Medium: mediumQuestions,
			Hard: hardQuestions,
		},
		puzzles,
		percentComplete: all_questions_published ? Math.min(percentComplete, 100) : 0,
	};
}

function userTopics(user) {
	const { role } = user;

	return new Promise((resolve) => {
		TopicCache.get((err, topicData) => {
			if (err) {
				resolve({});
			} else if (!topicData) {
				resolve({});
			} else {
				const topics = topicData ? topicData.topics : [];

				const puzzles =
					topicData && topicData.puzzles
						? topicData.puzzles
						: { total: 0, verified: 0, published: 0 };
				if (
					user.stats &&
					topicData &&
					user.markModified &&
					(!user.stats.calibrationDate ||
						user.stats.calibrationDate < topicData.calibrationDate)
				) {
					calibrateUserDifficulty(user, topics).then((difficulty) => {
						// calibrate user difficult stats
						user.stats.difficulty.Easy = difficulty.Easy;
						user.stats.difficulty.Medium = difficulty.Medium;
						user.stats.difficulty.Hard = difficulty.Hard;
						user.stats.calibrationDate = new Date();
						user.markModified('stats.difficulty');
						user.markModified('stats.calibrationDate');
						user.save();
					});
				}

				if (role === 'super' || role === 'admin') {
					const data = getSuperTopics(topics, user, puzzles);
					resolve(data);
				} else if (role === 'moderator') {
					return Client.findOne({ moderators: user._id }, { phases: 1 })
						.populate([{ path: 'phases', select: 'topics' }])
						.then((client) => {
							if (client) {
								const data = getModeratorTopics(topics, user, puzzles, client);
								resolve(data);
							} else {
								// console.log('check data2', client, user._id);
								resolve({});
							}
						});
				} else {
					const data = getUserTopics(topics, user, puzzles);
					resolve(data);
				}
			}
		});
	});
}

function evalcat(category) {
	return category;
}

function secureUser(user) {
	let correct = 0;
	let incorrect = 0;
	let unattempted = 0;
	let correctTime = 0;
	let incorrectTime = 0;
	let unattemptedTime = 0;

	let subscriptions = null;
	if (user.subscriptions) {
		subscriptions = user.subscriptions.map((us) => ({
			group: us.group,
			rating: us.rating,
			overall_rank: us.overall_rank,
			subgroups: us.subgroups.map((sg) => {
				if (
					sg.group === '5dd96847c7cf1c4cc51fbec4' ||
					sg.group === '5dd43bda148abe16c91ddd0b' ||
					sg.group === '5e60f28a662f740d1ecff775' ||
					sg.group === '5ef32683beb2c52308854f5b' ||
					sg.group === '5f081499ee1ac71473a9ffb6' ||
					sg.group === '5f2a3c3519d0820cb76410c1'
				) {
					return {
						group: sg.group,
						overall_rank: us.overall_rank,
						phases: [],
					};
				}
				return {
					group: sg.group,
					overall_rank: us.overall_rank,
					phases: sg.phases,
				};
			}),
		}));
	}

	const securedUser = {
		_id: user._id,
		currentBatch: user.currentBatch,
		batchHistory: user.batchHistory,
		username:
			user.username && user.username.split('_')[0] === 'NOTSET'
				? ''
				: user.username,
		category: evalcat(user.category),
		name: user.name,
		mobileNumber: user.mobileNumber,
		email: user.email,
		isVerified: user.isVerified,
		session: user.session,
		liveAssessment: user.liveAssessment,
		phases: user.phases,
		subjects: user.subjects,
		stats: {
			topics: user.stats.topics.map((topic) => {
				let topicCorrect = 0;
				let topicIncorrect = 0;
				let topicUnattempted = 0;
				let topicCorrectTime = 0;
				let topicIncorrectTime = 0;
				let topicUnattemptedTime = 0;
				if (topic.test_performance) {
					Object.keys(topic.test_performance).forEach((k) => {
						correct += topic.test_performance[k].correct;
						incorrect += topic.test_performance[k].incorrect;
						unattempted += topic.test_performance[k].unattempted;
						correctTime += topic.test_performance[k].correctTime;
						incorrectTime += topic.test_performance[k].incorrectTime;
						unattemptedTime += topic.test_performance[k].unattemptedTime;
						topicCorrect += topic.test_performance[k].correct;
						topicIncorrect += topic.test_performance[k].incorrect;
						topicUnattempted += topic.test_performance[k].unattempted;
						topicCorrectTime += topic.test_performance[k].correctTime;
						topicIncorrectTime += topic.test_performance[k].incorrectTime;
						topicUnattemptedTime += topic.test_performance[k].unattemptedTime;
					});
				} else {
					topic.test_performance = {};
				}

				topic.test_performance.correct = topicCorrect;
				topic.test_performance.incorrect = topicIncorrect;
				topic.test_performance.unattempted = topicUnattempted;
				topic.test_performance.correctTime = topicCorrectTime;
				topic.test_performance.incorrectTime = topicIncorrectTime;
				topic.test_performance.unattemptedTime = topicUnattemptedTime;
				return {
					id: topic.id,
					name: topic.name,
					percent_complete: topic.percent_complete,
					last_activity: topic.last_activity,
					test_performance: topic.test_performance,
					sub_topics: topic.sub_topics.map((sub_topic) => ({
						id: sub_topic.id,
						percent_complete: sub_topic.percent_complete,
						last_activity: sub_topic.last_activity,
						test_performance: sub_topic.test_performance,
					})),
				};
			}),
			rating: user.stats.rating,
			daily_activity: user.stats.daily_activity,
			overall_rank: user.stats.overall_rank,
			difficulty: user.stats.difficulty,
			test_performance: {
				correct,
				incorrect,
				unattempted,
				correctTime,
				incorrectTime,
				unattemptedTime,
			},
		},
		xp: {
			streak: user.streak,
			net: user.netXp ? Math.floor(user.netXp.val) : -1,
			referral: 0,
		},
		milestones: user.milestones,
		settings: user.settings,
		dp: user.dp,
		thumbnail: user.thumbnail,
		role: user.role,
		type: user.type,
		demoStep: user.demoStep,
		subscriptions, // send active subscriptions only. TBD
	};
	return securedUser;
}

function secureUserStats(stats) {
	let correct = 0;
	let incorrect = 0;
	let unattempted = 0;
	let correctTime = 0;
	let incorrectTime = 0;
	let unattemptedTime = 0;

	const secureStats = {
		topics: stats.topics.map((topic) => {
			let topicCorrect = 0;
			let topicIncorrect = 0;
			let topicUnattempted = 0;
			let topicCorrectTime = 0;
			let topicIncorrectTime = 0;
			let topicUnattemptedTime = 0;
			Object.keys(topic.test_performance).forEach((k) => {
				correct += topic.test_performance[k].correct;
				incorrect += topic.test_performance[k].incorrect;
				unattempted += topic.test_performance[k].unattempted;
				correctTime += topic.test_performance[k].correctTime;
				incorrectTime += topic.test_performance[k].incorrectTime;
				unattemptedTime += topic.test_performance[k].unattemptedTime;
				topicCorrect += topic.test_performance[k].correct;
				topicIncorrect += topic.test_performance[k].incorrect;
				topicUnattempted += topic.test_performance[k].unattempted;
				topicCorrectTime += topic.test_performance[k].correctTime;
				topicIncorrectTime += topic.test_performance[k].incorrectTime;
				topicUnattemptedTime += topic.test_performance[k].unattemptedTime;
			});
			topic.test_performance.correct = topicCorrect;
			topic.test_performance.incorrect = topicIncorrect;
			topic.test_performance.unattempted = topicUnattempted;
			topic.test_performance.correctTime = topicCorrectTime;
			topic.test_performance.incorrectTime = topicIncorrectTime;
			topic.test_performance.unattemptedTime = topicUnattemptedTime;
			return {
				id: topic.id,
				name: topic.name,
				percent_complete: topic.percent_complete,
				last_activity: topic.last_activity,
				test_performance: topic.test_performance,
				sub_topics: topic.sub_topics.map((subTopic) => ({
					id: subTopic.id,
					percent_complete: subTopic.percent_complete,
					last_activity: subTopic.last_activity,
					test_performance: subTopic.test_performance,
				})),
			};
		}),
		rating: stats.rating,
		daily_activity: stats.daily_activity,
		overall_rank: stats.overall_rank,
		difficulty: stats.difficulty,
		test_performance: {
			correct,
			incorrect,
			unattempted,
			correctTime,
			incorrectTime,
			unattemptedTime,
		},
	};
	return secureStats;
}

function updateReferral(username, id) {
	User.findOne({ username }).then((user) => {
		if (user) {
			const referral = new Referral({
				referrerUsername: username,
				referred: id,
			});
			referral.save();
		}
	});
}

module.exports = {
	secureUser,
	secureUserStats,
	userTopics,
	dateToday,
	filterSubscribedTopics,
	updateReferral,
};
