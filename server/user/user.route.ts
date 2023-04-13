import { Router } from 'express';
import { authenticate } from 'passport';
import {
	signin,
	addAccount,
	signinGoogle,
	signup,
	resetStats,
	get,
	endDemo,
	list,
	others,
	assignCollege,
	logoutOfOtherDevices,
	signout,
	support,
	updatePassword,
	forgotPassword,
	resetPassword,
	completeProfile,
	updateGoal,
	updateAccount,
	bookmark,
	bookmarks,
	buckets,
	verifyUser,
	resendVerificationToken,
	confirmToken,
	getXPConfig,
	cat,
	placement,
	jee,
	migrateEmailAddress,
	migrateStats,
	unsubscribe,
	updatePhase,
	fixStats,
	sendInvitation,
} from './user.controller';
import { getSubscribedTopics } from './user.topic.controller';
import { getReports } from './user.assessment.controller';
import { getPolicyAvatarUpload, updateAvatar } from './avatar.controller';
import auth from '../middleware/auth';
import {
	rewardXPToUsers,
	getTokensForUser,
	clearCache,
	downloadUserMarksData,
	markEmailsAsVerified,
	archiveUser,
	getPasswordResetLink,
	getUserAccountAnomalies,
	updateUserBatchBulk,
} from './admin.controller';
import { validateCreds, isSignupAllowed } from './middlewares';
import userGroupRoutes from './group/route';
import { withPhases } from '../phase/middlewares';
import accountRoutes from './routes/account';
import adminReportRoutes from './routes/adminReport';
import { withAdminPermission } from '../admin/permissions/middlewares';
import { searchUser } from './controllers/admin/search';
import { changeRole } from './controllers/admin/role';
import { signInUsingClientJWT } from './controllers/clientJwtAuth';
import userAdminRoutes from './routes/admin';

const router = Router(); // eslint-disable-line new-cap

router.use('/group', userGroupRoutes);
router.use('/account', accountRoutes);
router.use('/admin-report', adminReportRoutes);
router.use('/admin', userAdminRoutes);

router.route('/signin').post(validateCreds, signin);

router.route('/addaccount').post(auth.required, addAccount);

router.get(
	'/auth/login',
	(req, res, next) => {
		if (req.query.return) {
			req.session.oauth2return = req.query.return;
			req.session.noQueryParams = req.query.noQueryParams;
			req.session.code = req.query.state;
			req.session.supergroup = req.query.supergroup;
			req.session.subgroup = req.query.subgroup;
			req.session.client = req.query.client;
		}
		next();
	},
	authenticate('google', {
		scope: ['email', 'profile'],
	})
);

router.get('/auth/google/callback', authenticate('google'), signinGoogle);

router.route('/signup').post(isSignupAllowed, signup);

router.post('/resetStats', auth.required, resetStats);

router.route('/').post(auth.required, get).get(auth.required, get);

router.get('/endDemo/:step', auth.required, endDemo);
router.post('/list', auth.required, list);
router.get('/others', auth.required, others);
router.post('/assignCollege', auth.required, assignCollege);
router.route('/role').post(auth.required, auth.isModerator, changeRole);
router.get('/signout/others', auth.required, logoutOfOtherDevices);
router.get('/signout', auth.required, signout);
router
	.route('/support')
	.post(auth.required, auth.createWithUser('email name subscriptions'), support);
router.post('/updatePassword', auth.required, updatePassword);
router.route('/forgotPassword').post(forgotPassword);
router.route('/resetPassword').post(resetPassword);
router.post('/completeProfile', auth.required, completeProfile);
router.post('/updateGoal', auth.required, updateGoal);
router.post('/updateAccount', auth.required, updateAccount);
router.post('/bookmark', auth.required, bookmark);
router.post('/bookmarks', auth.required, bookmarks);
router.post('/buckets', auth.required, buckets);

router.post('/verify', auth.required, verifyUser);
router.get('/resend', auth.required, resendVerificationToken);
router.get('/confirmation:token', confirmToken);
router.get('/avatar/policy', auth.required, getPolicyAvatarUpload);
router.post('/avatar/update', auth.required, updateAvatar);
router.get('/xp-config', auth.required, getXPConfig);

router.route('/cat').get(cat);
router.route('/placement').get(placement);
router.route('/jee').get(jee);
router
	.route('/migrate_email_addresses')
	.post(auth.required, auth.isSuper, migrateEmailAddress);

router
	.route('/reward-xp-to-users')
	.post(auth.required, auth.isSuper, rewardXPToUsers);

router
	.route('/getTokenData')
	.post(auth.required, auth.isSuper, getTokensForUser);

router.route('/clear-cache').get(auth.required, auth.isSuper, clearCache);

router
	.route('/search')
	.post(auth.required, auth.isAtLeastMentor, withAdminPermission, searchUser);
router
	.route('/download-marks')
	.post(auth.required, auth.isModerator, downloadUserMarksData);

router
	.route('/verifyUsersBulk')
	.post(auth.required, auth.isModerator, withPhases, markEmailsAsVerified);

router.route('/archive-user').get(auth.required, auth.isSuper, archiveUser);

router
	.route('/get-password-reset-link')
	.get(auth.required, auth.isModerator, getPasswordResetLink);

router
	.route('/user-account-anomalies')
	.get(auth.required, auth.isSuper, getUserAccountAnomalies);

// router.get('/migrateXp', auth.required, userCtrl.migrateXp);
router.post('/migrateStats', auth.required, migrateStats);

router.route('/unsubscribe/:code').get(unsubscribe);

// app.post('/confirmation', userController.confirmationPost);
// app.post('/resend', userController.resendTokenPost);

router.post('/updatePhase', auth.required, updatePhase);
router.post('/fixStats', auth.required, fixStats);

router.route('/subscribedTopics').get(auth.required, getSubscribedTopics);

router.route('/send-invitation').post(auth.required, sendInvitation);

router.route('/get-reports').get(auth.required, getReports);
router
	.route('/update-batch')
	.post(auth.required, auth.isModerator, withPhases, updateUserBatchBulk);

router.route('/client-jwt-signin').get(signInUsingClientJWT);

export default router;
