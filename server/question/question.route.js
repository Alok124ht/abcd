const express = require('express');
const questionCtrl = require('./question.controller');
const fileCtrl = require('./file.controller');
const migrationCtrl = require('./migration.controller');
const authMiddleware = require('../middleware/auth').default;
const { changeQuestionType } = require('./controllers/changeQuestionType');
const { changeQuestionTopic } = require('./controllers/changeQuestionTopic');

const router = express.Router(); // eslint-disable-line new-cap

router.route('/').post(questionCtrl.create);

router.route('/add-with-unique-tag').post(questionCtrl.addWithUniqueTag);

router.route('/createMultiCorrect').post(questionCtrl.createMultiCorrect);

router.route('/createInteger').post(questionCtrl.createInteger);

router.route('/createRange').post(questionCtrl.createRange);

router.route('/createMTC').post(questionCtrl.createMTC);

router.route('/update').post(questionCtrl.update);

router.route('/archive').post(questionCtrl.archive);

router.route('/hide-in-search').post(questionCtrl.hideInSearch);

router.route('/updateMultiCorrect').post(questionCtrl.updateMultiCorrect);

router.route('/updateInteger').post(questionCtrl.updateInteger);

router.route('/updateRange').post(questionCtrl.updateRange);

router.route('/bulk').post(questionCtrl.createMany);

router.route('/get-question-image-upload-policy').get(fileCtrl.getPolicy);

router.route('/list-tags').get(authMiddleware.isAdmin, questionCtrl.listTags);
router
	.route('/setAnswers')
	.post(authMiddleware.isModerator, questionCtrl.setAnswers);
router
	.route('/:questionId') // not required
	.get(questionCtrl.getQuestion);

router.route('/getAttemptedResponse').post(questionCtrl.getAttemptedResponse);

router.route('/report').post(questionCtrl.reportQuestion);
router.route('/verify').post(questionCtrl.verify);
router.route('/publish').post(questionCtrl.publish);
router.route('/removeReports').post(questionCtrl.removeReports);
router.route('/publishMany').post(questionCtrl.publishMany);
router.route('/searchByTag').post(questionCtrl.searchByTag);
router.route('/verifyByTag').post(questionCtrl.verifyByTag);

router.route('/getMany').post(authMiddleware.isModerator, questionCtrl.getMany);

router.route('/getReported').post(questionCtrl.getReported);

router.route('/randomize').post(questionCtrl.randomize);

router
	.route('/migrateQuestion')
	.post(authMiddleware.isSuper, migrationCtrl.handleMigrateQuestionRequest);
router
	.route('/migrateQuestions')
	.post(authMiddleware.isSuper, migrationCtrl.handleMigrateQuestionsRequest);
router.route('/recalculateStats').post(questionCtrl.recalculateStats);

router
	.route('/createAndUpdateStatistics')
	.post(questionCtrl.createAndUpdateStatistics);

router
	.route('/clear-cache/:id')
	.get(authMiddleware.isModerator, questionCtrl.clearCache);

router
	.route('/convert-data/:id')
	.get(authMiddleware.isModerator, questionCtrl.convertData);

router
	.route('/update-client')
	.post(authMiddleware.isAdmin, questionCtrl.updateClient);

router
	.route('/changeQuestionType')
	.post(authMiddleware.isModerator, changeQuestionType);

router
	.route('/changeQuestionTopic')
	.post(authMiddleware.isModerator, changeQuestionTopic);

module.exports = router;
