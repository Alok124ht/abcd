const Bottleneck = require('bottleneck');
const User = require('../user/user.model').default;
const Usercategory = require('../user/usercategory.model').default;
const {
	initializeCategoryByUserId,
	updateCategory,
} = require('../assessment/categoryLib');
const lib = require('../lib.js'); // all simple functions are declared here, which don't need to be changed/understood

const getTopicIndex = lib.getTopicIndex;

function parseQuestionMeta(question) {
	const { time, correct } = question;

	const addToCorrect = correct === 1 ? 1 : 0;
	const addToIncorrect = correct === 0 ? 1 : 0;
	const addToUnattempted = correct === -1 ? 1 : 0;
	const addToCorrectTime = correct === 1 ? time : 0;
	const addToIncorrectTime = correct === 0 ? time : 0;
	const addToUnattemptedTime = correct === -1 ? time : 0;

	return {
		addToCorrect,
		addToIncorrect,
		addToUnattempted,
		addToCorrectTime,
		addToIncorrectTime,
		addToUnattemptedTime,
	};
}

function updateUserStats(user, metaSecs, coreSecs, wId) {
	// console.log('updating stats of user ...');
	const topics = user.stats.topics;
	topics.forEach((topic) => {
		delete topic.test_performance[wId];
		topic.sub_topics.forEach((sub_topic) => {
			delete sub_topic.test_performance[wId];
		});
	});
	metaSecs.forEach((sec, secIndex) => {
		sec.questions.forEach((que, queIndex) => {
			const topic = coreSecs[secIndex].questions[queIndex].question.topic;
			const sub_topic = coreSecs[secIndex].questions[queIndex].question.sub_topic;

			const {
				addToCorrect,
				addToUnattempted,
				addToIncorrect,
				addToCorrectTime,
				addToIncorrectTime,
				addToUnattemptedTime,
			} = parseQuestionMeta(que);

			let t = getTopicIndex(topics, topic);
			if (t === null) {
				topics.push({
					id: topic,
					percent_complete: 0,
					last_activity: {},
					test_performance: {},
					sub_topics: [
						{
							id: sub_topic,
							percent_complete: 0,
							last_activity: {},
							questions: [],
							test_performance: {},
						},
					],
				});
				t = topics.length - 1;
			}
			let st = getTopicIndex(topics[t].sub_topics, sub_topic);
			if (st === null) {
				topics[t].sub_topics.push({
					id: sub_topic,
					percent_complete: 0,
					last_activity: {},
					questions: [],
					test_performance: {},
				});
				st = topics[t].sub_topics.length - 1;
			}

			let old = topics[t].test_performance[wId];
			if (old && old.precision != null && old.count != null) {
				topics[t].test_performance[wId].precision += addToCorrect;
				topics[t].test_performance[wId].count += 1;
				topics[t].test_performance[wId].correct += addToCorrect;
				topics[t].test_performance[wId].incorrect += addToIncorrect;
				topics[t].test_performance[wId].unattempted += addToUnattempted;
				topics[t].test_performance[wId].correctTime += addToCorrectTime;
				topics[t].test_performance[wId].incorrectTime += addToIncorrectTime;
				topics[t].test_performance[wId].unattemptedTime += addToUnattemptedTime;
			} else {
				topics[t].test_performance[wId] = {
					precision: addToCorrect,
					count: 1,
					correct: addToCorrect,
					incorrect: addToIncorrect,
					unattempted: addToUnattempted,
					correctTime: addToCorrectTime,
					incorrectTime: addToIncorrectTime,
					unattemptedTime: addToUnattemptedTime,
				};
			}
			old = topics[t].sub_topics[st].test_performance[wId];
			if (old && old.precision != null && old.count != null) {
				topics[t].sub_topics[st].test_performance[wId].precision += addToCorrect;
				topics[t].sub_topics[st].test_performance[wId].count += 1;
				topics[t].sub_topics[st].test_performance[wId].correct += addToCorrect;
				topics[t].sub_topics[st].test_performance[wId].incorrect += addToIncorrect;
				topics[t].sub_topics[st].test_performance[
					wId
				].unattempted += addToUnattempted;
				topics[t].sub_topics[st].test_performance[
					wId
				].correctTime += addToCorrectTime;
				topics[t].sub_topics[st].test_performance[
					wId
				].incorrectTime += addToIncorrectTime;
				topics[t].sub_topics[st].test_performance[
					wId
				].unattemptedTime += addToUnattemptedTime;
			} else {
				topics[t].sub_topics[st].test_performance[wId] = {
					precision: addToCorrect,
					count: 1,
					correct: addToCorrect,
					incorrect: addToIncorrect,
					unattempted: addToUnattempted,
					correctTime: addToCorrectTime,
					incorrectTime: addToIncorrectTime,
					unattemptedTime: !addToUnattemptedTime,
				};
			}
		});
	});
	// user.stats = stats; // is this required??

	// write an update query for all this!!

	user.markModified('stats');
	// const t1 = new Date().getTime();
	return user.save().then(() => {
		// const t2 = new Date().getTime();
		// console.log('time to update stats', t2 - t1);
		// console.log('resolving stats', user.stats);
		return Promise.resolve({ stats: user.stats });
	});
}

class StatsAndCategoryManager {
	// only update activity once a day
	constructor() {
		// this.attemptQueue = [];
		this.statsLimiter = new Bottleneck({
			maxConcurrent: 1,
			minTime: 200,
		});
		this.categoryLimiter = new Bottleneck({
			maxConcurrent: 1,
			minTime: 200,
		});
	}

	static updateStats(userId, metaSections, coreSections, wrapperId) {
		// const t1 = new Date().getTime();
		User.findById(userId, { stats: 1 }).then((user) => {
			// can we use cache here??
			// const t2 = new Date().getTime();
			// console.log('time to fetch user', t2 - t1);
			if (user !== null) {
				// console.log('updating stats of user', userId);
				updateUserStats(user, metaSections, coreSections, wrapperId);
			}
		});
	}

	processStats(userId, metaSections, coreSections, wrapperId) {
		// console.log('process stat called');
		this.statsLimiter.schedule(() =>
			StatsAndCategoryManager.updateStats(
				userId,
				metaSections,
				coreSections,
				wrapperId
			)
		);
	}

	static updateUserCategory(userId, assessmentCore, submission) {
		// const t1 = new Date().getTime();
		Usercategory.findOne({ user: userId }).then((category) => {
			// const t2 = new Date().getTime();
			// console.log('check time for 1', t2 - t1);
			if (!category) {
				// console.log('initializing category...');
				initializeCategoryByUserId(userId).then((categoryId) => {
					Usercategory.findOne({ _id: categoryId }).then((categoryNew) => {
						updateCategory(categoryNew, assessmentCore, submission);
					});
				});
			} else {
				// console.log('not initializing category...');
				updateCategory(category, assessmentCore, submission);
			}
		});
	}

	processCategory(userId, assessmentCore, submission) {
		this.categoryLimiter.schedule(() =>
			StatsAndCategoryManager.updateUserCategory(
				userId,
				assessmentCore,
				submission
			)
		);
	}
}

module.exports = new StatsAndCategoryManager();
