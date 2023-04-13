import express from 'express';
import auth from '../middleware/auth';
import topicCtrl from './topic.controller';

const router = express.Router();

router.route('/').get(topicCtrl.get);

router.route('/bulk').post(topicCtrl.createMany);

router.route('/newtopic').post(topicCtrl.createTopic);

router.route('/newsubtopic').post(topicCtrl.createSubtopic);

router.route('/calibrateStats').post(topicCtrl.calibrateStats);

router.route('/updateTag').post(topicCtrl.updateTag);

router.route('/addConcept').post(topicCtrl.addConcept);
router
	.route('/removeConcepts')
	.post(auth.isModerator, topicCtrl.removeConcepts);

router.route('/calibrateDifficulty').post(topicCtrl.calibrateDifficulty);

router.route('/removeTopic').post(topicCtrl.removeTopic);
router.route('/removeSubtopic').post(topicCtrl.removeSubtopic);

router.route('/defaultnote/:subTopicId').get(topicCtrl.getDefaultNote);
router.route('/updatenote').post(topicCtrl.updateNote);

export default router;
