import { Router } from 'express';
import { withPhases } from '../../phase/middlewares';

import auth from '../../middleware/auth';
import {
	withUserVideoStat,
	withUserVideoActivity,
	addActivities,
	getMyProgress,
	getMyStats,
	getActivitiesByUser,
	getActivitiesByVideo,
	getActivitiesForPlaylists,
	getMyCompletedVideos,
	withUserVideoStatAdmin,
	withUserVideoActivityAdmin,
	getViewersOfVideo,
} from '../controllers/activity';
import {
	getVideoDataByPhases,
	submissionGraphForPhase,
} from '../controllers/stats';

const router = Router(); // eslint-disable-line new-cap

router.use(
	'/register',
	auth.required,
	withUserVideoStat,
	withUserVideoActivity,
	addActivities
);

router
	.route('/admin/register')
	.post(
		auth.required,
		auth.isAtLeastMentor,
		withUserVideoStatAdmin,
		withUserVideoActivityAdmin,
		addActivities
	);

router.get('/myProgress', auth.required, getMyProgress);
router.route('/myStats').get(auth.required, getMyStats);

router.route('/completed-videos').get(auth.required, getMyCompletedVideos);

router.route('/dataByUser').get(auth.required, getActivitiesByUser);
router
	.route('/dataByVideo')
	.get(auth.required, auth.isAtLeastMentor, getActivitiesByVideo);

router
	.route('/dataByPlaylists')
	.get(auth.required, auth.isModerator, getActivitiesForPlaylists);

router
	.route('/getVideoDataByPhase')
	.get(auth.required, auth.isModerator, withPhases, getVideoDataByPhases);

router
	.route('/assignment-submission-graph/:phase')
	.get(auth.required, auth.isAtLeastMentor, submissionGraphForPhase);

router
	.route('/admin/getViewersOfVideo')
	.get(auth.required, auth.isAtLeastMentor, getViewersOfVideo);

export default router;
