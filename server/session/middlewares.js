const Session = require('./session.model').default;
const UserQuestionAttempts = require('../models/UserQuestionAttempts').default;
const { getAttemptedQuestions } = require('../lib.js');

const sessionIsActive = (req, res, next) => {
	const { session } = res.locals;
	if (session.hasEnded || session.endTime) {
		res.status(422).send({ message: 'Session has ended', code: 'session-ended' });
	} else {
		next();
	}
};

const createWithSession = (populate) => (req, res, next) => {
	const id = req.query.id || req.body.id;
	const { id: userId } = req.payload;
	const query = Session.findById(id);
	if (populate) {
		if (Array.isArray(populate)) {
			populate.forEach((p) => {
				query.populate(p);
			});
		} else {
			// if(populate.indexOf('questions.question') !== -1) {
			// } else {
			query.populate(populate);
			// }
		}
	}
	query.exec((searchError, session) => {
		if (searchError || !session) {
			res.status(422).send({ message: 'Session not found!' });
		} else if (session.user.equals(userId)) {
			res.locals.session = session; // eslint-disable-line no-param-reassign
			next();
		} else {
			res.status(404).send({ message: 'Session not found' });
		}
	});
};

const withUserAttemptedQuestions = (req, res, next) => {
	const { id: userId } = req.payload;
	try {
		const attemptedQuestions = getAttemptedQuestions(res.locals.user);
		res.locals.userAttemptedQuestions = attemptedQuestions; // eslint-disable-line no-param-reassign
		UserQuestionAttempts.findOne({ user: userId }).exec(
			(searchError, userAttempts) => {
				if (searchError || !userAttempts) {
					next();
				} else {
					// eslint-disable-next-line no-param-reassign
					res.locals.userAttemptedQuestions = [
						...res.locals.userAttemptedQuestions,
						...userAttempts.items.map((item) => item.question),
					];

					next();
				}
			}
		);
	} catch (e) {
		res.status(500).send({
			message: 'Internal server error',
			code: 'failed-to-get-user-attempted-questions',
		});
	}
};

const withCreateSessionParams = (req, res, next) => {
	const { filters, title, config = {}, assessment = '' } = req.body;
	try {
		const parsedFilters = JSON.parse(filters);
		// eslint-disable-next-line no-param-reassign
		res.locals.sessionParams = {
			filters: parsedFilters,
			config: JSON.parse(config),
			title,
			assessment,
		};
		next();
	} catch (e) {
		if (typeof filters === 'object') {
			// eslint-disable-next-line no-param-reassign
			res.locals.sessionParams = {
				filters,
				config,
				title,
				assessment,
			};
			next();
		} else {
			res.status(422).send({
				message: 'Can not create session',
				filters,
				code: 'invalid-params',
			});
		}
	}
};

const createIsSessionActiveQuery = (userId) => ({
	$and: [
		{ user: userId },
		{ $or: [{ hasEnded: false }, { endTime: { $exists: false } }] },
	],
});

const userHasNoActiveSessions = (req, res, next) => {
	const { id: userId } = req.payload;
	Session.findOne(createIsSessionActiveQuery(userId)).exec((error, session) => {
		if (error) {
			res.status(500).send({
				message: 'Internal server error while searching for existing session.',
			});
		} else if (session) {
			res.status(422).send({
				message: 'A session is already in progress.',
				code: 'session-in-progress',
				sessionId: session._id,
			});
		} else {
			next();
		}
	});
};

// TODO: improve validation
const validateAnswer = (req, res, next) => {
	const { session } = res.locals;
	const { config } = session;
	const { prevent } = config;
	const { questionId } = req.body;
	let isValid = true;
	if (prevent.reattempt) {
		session.questions.forEach((item) => {
			if (item.question.equals(questionId)) {
				if (item.attempt.isSkipped || item.attempt.isAnswered) {
					isValid = false;
				}
			}
		});
	}

	if (isValid) {
		next();
	} else {
		res
			.status(422)
			.send({ message: 'You can not re-attempt a question in this session.' });
	}
};

const sessionHasCanReattempt = (req, res, next) => {
	const { session } = res.locals;
	try {
		if (session.config.prevent.reattempt) {
			res.status(403).send({ message: 'You can not reattempt a question.' });
		} else {
			next();
		}
	} catch (e) {
		res
			.status(500)
			.send({ message: 'Some error occurred while verifying can-reattempt.' });
	}
};

const sessionHasPreventReattempt = (req, res, next) => {
	const { session } = res.locals;
	try {
		if (session.config.prevent.reattempt) {
			next();
		} else {
			res.status(403).send({ message: 'You can not reattempt a question.' });
		}
	} catch (e) {
		res
			.status(500)
			.send({ message: 'Some error occurred while verifying can-reattempt.' });
	}
};

module.exports = {
	createIsSessionActiveQuery,
	createWithSession,
	sessionHasCanReattempt,
	sessionHasPreventReattempt,
	sessionIsActive,
	userHasNoActiveSessions,
	validateAnswer,
	withCreateSessionParams,
	withSession: createWithSession('questions.attempt'),
	withUserAttemptedQuestions,
};
