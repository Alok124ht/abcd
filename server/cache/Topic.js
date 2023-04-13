const Topic = require('../topic/topic.model').default;
const Question = require('../question/question.model').default;
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 10,
	ttl: 24 * 60 * 60,
});

function updateDataLevel(topicData) {
	// use bulk query to update topics
	let subTopicToCalibrate = '';
	topicData.topics.forEach((topic) => {
		topic.sub_topics.forEach((subTopic) => {
			const dateNow = new Date().getTime();
			const calibrationDate = subTopic.calibrationDate.getTime();
			if (
				subTopicToCalibrate === '' &&
				dateNow > calibrationDate + 1 * 24 * 60 * 60 * 1000
			) {
				subTopicToCalibrate = subTopic._id;
				subTopic.calibrationDate = new Date();
			}
		});
	});

	if (subTopicToCalibrate) {
		Question.find({
			sub_topic: subTopicToCalibrate.toString(),
			isPublished: true,
		})
			.exec()
			.then((questions) => {
				const dataData = { sumAttempts: 0, sumQuestions: 0, totalQuestions: 0 };
				questions.forEach((question) => {
					if (question.stats.attempts.length) {
						dataData.sumAttempts += question.stats.attempts.length;
						dataData.sumQuestions += 1;
					}
					dataData.totalQuestions += 1;
				});

				const extra = Math.min(
					0.2 * dataData.totalQuestions,
					dataData.totalQuestions - dataData.sumQuestions
				);

				dataData.sumQuestions += extra;
				let dataLevel = 0;
				if (dataData.sumQuestions) {
					dataLevel = (1.0 * dataData.sumAttempts) / dataData.sumQuestions;
				}
				dataLevel = Math.max(0.01, dataLevel);

				topicData.topics.forEach((topic) => {
					topic.sub_topics.forEach((subTopic) => {
						if (subTopicToCalibrate === subTopic._id) {
							subTopic.dataLevel = dataLevel;
						}
					});
				});

				topicData.markModified('topics');
				topicData.save();
			});
	}
}

function getTopics(cacheCallback) {
	// id is not used
	Topic.list()
		.then((topics) => {
			if (topics) {
				updateDataLevel(topics);
				cacheCallback(null, topics.toObject());
			} else {
				cacheCallback(null, topics);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function get(cb) {
	// id is not used
	const uniqueId = 'x-topics';
	memoryCache.wrap(
		uniqueId,
		(cacheCallback) => {
			getTopics(cacheCallback); // unique id is not used
		},
		cb
	);
}

module.exports = {
	get,
};
