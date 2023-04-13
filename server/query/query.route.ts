import { Router } from 'express';
import {
	allusers,
	placementusers,
	catusers,
	placementbutcatusers,
	createSingleUser,
	visitors,
	listSubmissions,
	deleteSubmission,
	fixreferrals,
	getreferrals,
	fixtraction,
	gettractions,
	updatePhase,
	updateEmail,
	updateUsername,
	migrateQuestions,
	migrateBookmarks,
	createBuckets,
	addRegistration,
} from './query.controller';
import { withPhases } from '../phase/middlewares';
import auth from '../middleware/auth';

const router = Router(); // eslint-disable-line new-cap

router.route('/allusers').get(allusers);

router.route('/placementusers').get(placementusers);

router.route('/catusers').get(catusers);

router.route('/placementbutcatusers').get(placementbutcatusers);

router.route('/createSingleUser').post(createSingleUser);

router.route('/visitors').get(visitors);

router.route('/submissions').post(auth.isModerator, listSubmissions);

router.route('/delete-submission').post(auth.isModerator, deleteSubmission);

router.route('/fixreferrals').get(fixreferrals);

router.route('/getreferrals').get(getreferrals);

router.route('/fixtraction').get(fixtraction);

router.route('/gettractions').get(gettractions);

router.route('/update-phase').post(updatePhase);

router
	.route('/update-email')
	.post(auth.isAtLeastMentor, withPhases, updateEmail);

router.route('/update-username').post(updateUsername);

router.route('/migrate-question').get(migrateQuestions);

router.route('/migrate-bookmarks').get(migrateBookmarks);

router.route('/create-buckets').get(createBuckets);

router.route('/add-registration').post(addRegistration);

export default router;
