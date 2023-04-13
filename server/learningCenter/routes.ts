import { Router } from 'express';
import auth from '../middleware/auth';
import {
	filePrefix,
	onIngestJobComplete,
	createDraft,
	createEmbed,
	createHLS,
} from './controllers/upload';
import { myUploads } from './controllers/list';
import {
	getMyPlaylists,
	getMyPlaylist,
	createPlaylist,
	createPolicyForPlaylistIcon,
	addItemsToPlaylist,
	removeItemFromPlaylist,
	removeItemsFromPlaylist,
	upadtePlaylistItem,
	addToAccessibleList,
	removeFromAccessibleList,
	updateAccessibleTo,
	updatePlaylist,
	getVideoProgress,
} from './controllers/playlist';
import { getDrafts } from './controllers/draft';
import { archiveVideo, unarchiveVideo, updateVideo } from './controllers/video';
import commentController from './controllers/comment';
import playlistSettingsRoutes from './playlistSettings.routes';
import {
	getVideoCount,
	unauthorized__getPlaylistsForPhase,
} from './controllers/public_endpoints';
import {
	createPolicyForDocument,
	createResourceDocument,
	updateResourceDocument,
	getMyUploads,
	updateResourceVisibility,
} from './controllers/resource';
import activityRouter from './route/activity';
import coursePlanRouter from './route/coursePlan';
import { hasAccessToPlaylist } from './middlewares';
import { withUserGroups } from '../user/middlewares';
import scorecardRouter from './route/scorecard';
import { getPlaylist, getPlaylists } from './controllers/public_list';
import { toggleVisibility } from './controllers/playlist';

const router = Router(); // eslint-disable-line new-cap

router.route('/message').post((req, res, next) => {
	// console.log(req.body);
	let message;
	try {
		// console.log('entering try');
		const body = JSON.parse(req.body);
		// console.log(body.Message, body);
		message = JSON.parse(body.Message);
	} catch (e) {
		console.log(req.body);
		console.error(e);
		res.status(422).send({ message: 'Can not parse body' });
		return;
	}
	console.log(message);
	try {
		const guid = message.guid;
		const srcVideo = message.srcVideo;
		if (
			message.workflowStatus === 'Complete' &&
			message.workflowName === 'video-on-demand' &&
			message.srcVideo.indexOf(filePrefix) === 0
		) {
			// eslint-disable-next-line no-param-reassign
			res.locals.message = message;
			console.log('video created with guid:', guid, 'srcVideo:', srcVideo);
			next();
			return;
		}
	} catch (e) {
		console.log(e);
	}
	console.log('not an ingest for this environment or payload is wrong');
	res.send({ message: 'true', body: req.body });
}, onIngestJobComplete);

/**
 * endpoints for admin side
 */
router.post('/draft', auth.required, auth.isAtLeastMentor, createDraft);
router
	.route('/video/:id')
	.patch(auth.required, auth.isAtLeastMentor, updateVideo);
router.post('/embed', auth.required, auth.isAtLeastMentor, createEmbed);
router.route('/hls').post(auth.required, auth.isAtLeastMentor, createHLS);

router.route('/video/archive').post(auth.required, archiveVideo);

router.route('/video/restore').post(auth.required, unarchiveVideo);

/**
 * Documents API starts
 */

const resourceRoleValidator = auth.isAtLeastMentor;
router
	.route('/resources/document/policy')
	.post(auth.required, resourceRoleValidator, createPolicyForDocument);
router
	.route('/resources/document')
	.post(auth.required, resourceRoleValidator, createResourceDocument)
	.patch(auth.required, resourceRoleValidator, updateResourceDocument);

router
	.route('/resources/my/uploads')
	.get(auth.required, resourceRoleValidator, getMyUploads);
/**
 * Documents API ends
 */

router.get('/my/uploads', auth.required, auth.isAtLeastMentor, myUploads);
router.get('/my/drafts', auth.required, getDrafts);

router.get('/my/playlists', auth.required, getMyPlaylists);
router.get(
	'/my/playlist/:id',
	auth.required,
	hasAccessToPlaylist,
	getMyPlaylist
);

router.route('/playlist').post(auth.required, createPlaylist);

router.get(
	'/playlist/icon/policy/:id',
	auth.required,
	hasAccessToPlaylist,
	createPolicyForPlaylistIcon
);

router
	.route('/playlist/items/add')
	.post(auth.required, hasAccessToPlaylist, addItemsToPlaylist);
router
	.route('/playlist/item/remove')
	.delete(auth.required, hasAccessToPlaylist, removeItemFromPlaylist);
router
	.route('/playlist/items/remove')
	.delete(auth.required, hasAccessToPlaylist, removeItemsFromPlaylist);
router
	.route('/playlist/items/update')
	.patch(auth.required, hasAccessToPlaylist, upadtePlaylistItem);

router
	.route('/playlist/accessibleTo/add')
	.post(auth.required, hasAccessToPlaylist, addToAccessibleList);
router
	.route('/playlist/accessibleTo/remove')
	.post(auth.required, hasAccessToPlaylist, removeFromAccessibleList);

router
	.route('/playlist/accessibleTo')
	.patch(auth.required, hasAccessToPlaylist, updateAccessibleTo);

router
	.route('/playlist/toggle-visibility')
	.post(auth.required, toggleVisibility);

router.use('/playlist/settings', playlistSettingsRoutes);

/**
 * this is in the end because this might match other route if kept before otherss
 * */
router.patch(
	'/playlist/:id',
	auth.required,
	hasAccessToPlaylist,
	updatePlaylist
);
/**
 * end of admin endpoints
 */

/**
 * endpoints for public
 */
router.get(
	'/playlists',
	auth.required,
	auth.withUser,
	withUserGroups,
	getPlaylists
);

router.get(
	'/playlist/:id',
	auth.required,
	auth.withUser,
	withUserGroups,
	getPlaylist
);

router.get('/getStats', auth.required, getVideoProgress);

router.get('/itemCount', auth.required, auth.withUser, getVideoCount);

router.route('/playlists/:phase').get(unauthorized__getPlaylistsForPhase);

router.route('/comment').post(auth.required, commentController.addComment);

router.route('/comments').get(auth.required, commentController.getComments);

router
	.route('/resource/change-visibility/:id')
	.get(auth.required, auth.isModerator, updateResourceVisibility);

router.use('/activity', activityRouter);
router.use('/course-plan', coursePlanRouter);
router.use('/scorecard', scorecardRouter);

export default router;
