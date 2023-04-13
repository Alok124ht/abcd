const QuestionStatistics = require('../question/QuestionStatistics.model');
const cacheManager = require('./cache-manager');

const memoryCache = cacheManager({
	max: 10000,
	ttl: 60 * 60,
});

const projection = {
	_id: 1,
};

const prefix = 'qs-';

function getQuestionStatistics(id, cacheCallback) {
	QuestionStatistics.findOne({ question: id }, projection)
		.then((questionStatistics) => {
			if (questionStatistics) {
				cacheCallback(null, questionStatistics.toObject());
			} else {
				cacheCallback(null, questionStatistics);
			}
		})
		.catch((err) => {
			cacheCallback(err);
		});
}

function getManyQuestionStatistics(ids, cacheCallback) {
	QuestionStatistics.find({ question: { $in: ids } }, {_id: 1, question: 1})
		.then((questionStatistics) => {
			const questionStatisticsById = {};
			questionStatistics.forEach((question) => {
				if(question) {
					questionStatisticsById[question.question] = {_id: question._id};
				}
			});
			cacheCallback(null, ids.map((id) => questionStatisticsById[id]));
		})
		.catch((err) => {
			cacheCallback(err);
		});
};

function get(id, cb) {
	const uniqueId = prefix + id;
	memoryCache.wrap(
		uniqueId,
		function(cacheCallback) {
			getQuestionStatistics(id, cacheCallback);
		},
		cb
	);
}

function getMany(ids, cb) {
	const uniqueIds = ids.map((id) => prefix + id);
	if (!uniqueIds.length) {
		cb(null, []);
	} else if (uniqueIds.length === 1) {
		memoryCache.wrap(
			uniqueIds[0],
			function(cacheCallback) {
				getQuestionStatistics(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(null, [result]);
			}
		);
	} else {
		memoryCache.wrap(
			...uniqueIds,
			function(cacheCallback) {
				getManyQuestionStatistics(ids, cacheCallback);
			},
			(err, result) => {
				if (err) {
					cb(err, result);
				} else if (uniqueIds.length < 2) { // not needed now ??
					cb(null, [result]);
				} else {
					cb(null, result);
				}
			}
		);
	}
}

module.exports = {
	get,
	getMany,
};
