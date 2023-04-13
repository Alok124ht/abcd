const Question = require('../question/question.model').default;
const cacheManager = require('./cache-manager');
const {
	projectionWithContentWithoutAnswers,
} = require('../question/constants');

const memoryCacheWithoutContent = cacheManager({
	max: 10000,
	ttl: 60 * 60,
});

const memoryCacheWithContent = cacheManager({
	max: 10000,
	ttl: 60 * 60,
});

const projectionWithoutContent = {
	// used for grading?
	_id: 1,
	'options._id': 1,
	'options.isCorrect': 1,
	'multiOptions._id': 1,
	'multiOptions.isCorrect': 1,
	answers: 1,
	integerAnswer: 1,
	range: 1,
	type: 1,
	level: 1,
	statistics: 1,
	topic: 1,
	sub_topic: 1,
};

const withoutContentPrefix = 'q-woc-';
const withContentPrefix = 'q-wc-';

const createGetQuestion = (projection, populate) =>
	function getQuestion(id, cacheCallback) {
		Question.findById(id, projection)
			.populate(populate)
			.then((question) => {
				if (question) {
					cacheCallback(null, question.toObject());
				} else {
					cacheCallback(null, question);
				}
			})
			.catch((err) => {
				cacheCallback(err);
			});
	};

const createGetManyQuestions = (projection, populate) =>
	function getManyQuestions(ids, cacheCallback) {
		Question.find({ _id: { $in: ids } }, projection)
			.populate(populate)
			.then((questions) => {
				const questionsById = {};
				questions.forEach((question) => {
					questionsById[question._id] = question.toObject();
				});
				cacheCallback(
					null,
					ids.map((id) => questionsById[id])
				);
			})
			.catch((err) => {
				cacheCallback(err);
			});
	};

const getQuestionWithoutContent = createGetQuestion(projectionWithoutContent, [
	{ path: 'statistics', select: 'perfectTimeLimits' },
]);
const getQuestionWithContent = createGetQuestion(
	projectionWithContentWithoutAnswers,
	[{ path: 'statistics', select: 'perfectTimeLimits' }]
);

const getManyQuestionWithoutContent = createGetManyQuestions(
	projectionWithoutContent,
	[{ path: 'statistics', select: 'perfectTimeLimits' }]
);
const getManyQuestionWithContent = createGetManyQuestions(
	projectionWithContentWithoutAnswers,
	[{ path: 'statistics', select: 'perfectTimeLimits' }]
);

function getWithoutContent(id, cb) {
	const uniqueId = withoutContentPrefix + id;
	memoryCacheWithoutContent.wrap(
		uniqueId,
		(cacheCallback) => {
			getQuestionWithoutContent(id, cacheCallback);
		},
		cb
	);
}

function getManyWithoutContent(ids, cb) {
	const uniqueIds = ids.map((id) => withoutContentPrefix + id);
	if (!uniqueIds.length) {
		cb(null, []);
	} else if (uniqueIds.length === 1) {
		memoryCacheWithoutContent.wrap(
			uniqueIds[0],
			(cacheCallback) => {
				getQuestionWithoutContent(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(null, [result]);
			}
		);
	} else {
		memoryCacheWithoutContent.wrap(
			...uniqueIds,
			(cacheCallback) => {
				getManyQuestionWithoutContent(ids, cacheCallback);
			},
			(err, result) => {
				if (err) {
					cb(err, result);
				} else if (uniqueIds.length < 2) {
					cb(null, [result]);
				} else {
					cb(null, result);
				}
			}
		);
	}
}

function getWithContent(id, cb) {
	const uniqueId = withContentPrefix + id;
	memoryCacheWithContent.wrap(
		uniqueId,
		(cacheCallback) => {
			getQuestionWithContent(id, cacheCallback);
		},
		cb
	);
}

function getManyWithContent(ids, cb) {
	const uniqueIds = ids.map((id) => withContentPrefix + id);
	if (!uniqueIds.length) {
		cb(null, []);
	} else if (uniqueIds.length === 1) {
		memoryCacheWithContent.wrap(
			uniqueIds[0],
			(cacheCallback) => {
				getQuestionWithContent(ids[0], cacheCallback);
			},
			(err, result) => {
				cb(null, [result]);
			}
		);
	} else {
		memoryCacheWithContent.wrap(
			...uniqueIds,
			(cacheCallback) => {
				getManyQuestionWithContent(ids, cacheCallback);
			},
			(err, result) => {
				if (err) {
					cb(err, result);
				} else if (uniqueIds.length < 2) {
					cb(null, [result]);
				} else {
					cb(null, result);
				}
			}
		);
	}
}

module.exports = {
	getWithoutContent,
	getManyWithoutContent,
	getWithContent,
	getManyWithContent,
};
