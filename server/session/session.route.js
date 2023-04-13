const express = require('express');
const sessionCtrl = require('./session.controller');
const middlewares = require('./middlewares');
const { createWithUser } = require('../middleware/auth').default;

const router = express.Router(); // eslint-disable-line new-cap

router
	.route('/new')
	.post(
		middlewares.userHasNoActiveSessions,
		middlewares.withCreateSessionParams,
		sessionCtrl.create,
		createWithUser('stats'),
		middlewares.withUserAttemptedQuestions,
		sessionCtrl.addAQuestionToSession,
		sessionCtrl.getQuestionAtPosition
	);

router.route('/endAllActive').post(sessionCtrl.endAllActive);

// active session end points
router.route('/getQuestionAtPosition').get(
	// middlewares.withSession,
	middlewares.createWithSession([
		// {
		// 	path: 'questions.question',
		// 	select: 'concepts',
		// },
		{ path: 'questions.attempt' },
	]),
	// middlewares.sessionIsActive,
	sessionCtrl.getQuestionAtPosition
);

// TODO: add validation to check save_answer is only called when user CAN reattempt
router.route('/save_answer').post(
	middlewares.createWithSession([
		{
			path: 'questions.question',
		},
		{ path: 'questions.attempt' },
	]),
	middlewares.sessionIsActive,
	middlewares.sessionHasCanReattempt,
	sessionCtrl.saveAnswer
);
// TODO: add validation to check save_answer is only called when user can NOT reattempt
router.route('/answer').post(
	middlewares.createWithSession([
		{
			path: 'questions.question',
			populate: {
				path: 'statistics',
				select: 'perfectTimeLimits',
			},
		},
		{ path: 'questions.attempt' },
	]),
	createWithUser('settings xp stats netXp streak'),
	middlewares.sessionIsActive,
	middlewares.sessionHasPreventReattempt,
	middlewares.validateAnswer,
	sessionCtrl.answerQuestion
);

router.route('/newQuestion').get(
	middlewares.createWithSession([
		{
			path: 'questions.question',
			populate: {
				path: 'statistics',
				select: 'perfectTimeLimits',
			},
		},
		{ path: 'questions.attempt' },
	]),
	middlewares.sessionIsActive,
	createWithUser('stats'),
	middlewares.withUserAttemptedQuestions,
	sessionCtrl.addAQuestionToSession,
	sessionCtrl.getQuestionAtPosition
);

router
	.route('/setQuestionSelectionForSession')
	.post(
		middlewares.withSession,
		middlewares.sessionIsActive,
		sessionCtrl.setQuestionSelectionForSession
	);

router
	.route('/set_active_question')
	.patch(
		middlewares.createWithSession([{ path: 'questions.attempt' }]),
		middlewares.sessionIsActive,
		middlewares.sessionHasCanReattempt,
		sessionCtrl.setActiveQuestion
	);

router
	.route('/note')
	.patch(
		middlewares.withSession,
		middlewares.sessionIsActive,
		sessionCtrl.updateNote
	);

router
	.route('/bookmark')
	.post(
		middlewares.withSession,
		// middlewares.sessionIsActive,
		createWithUser('bookmarks'),
		sessionCtrl.bookmarkQuestion
	)
	.delete(
		middlewares.withSession,
		createWithUser('bookmarks'),
		sessionCtrl.removeBookmark
	);

router
	.route('/end')
	.post(
		middlewares.withSession,
		middlewares.sessionIsActive,
		middlewares.sessionHasPreventReattempt,
		sessionCtrl.end
	);

router.route('/endSessionWithReattempt').post(
	middlewares.createWithSession([
		{
			path: 'questions.question',
			populate: {
				path: 'statistics',
				select: 'perfectTimeLimits',
			},
		},
		{ path: 'questions.attempt' },
	]),
	middlewares.sessionIsActive,
	middlewares.sessionHasCanReattempt,
	sessionCtrl.end
);

// end of active session end points

router.route('/list').get(sessionCtrl.getList);
router.route('/').get(sessionCtrl.get);

module.exports = router;
