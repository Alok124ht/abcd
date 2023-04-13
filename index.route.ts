import express from 'express';
import userRoutes from './server/user/user.route';
import questionsRoutes from './server/question/question.route';
import puzzlesRoutes from './server/phase/puzzle/puzzle.route';
import sessionRouter from './server/session/session.route';
import topicsRoutes from './server/topic/topic.route';
import draftRoutes from './server/draft/draft.route';
import assessmentRoutes from './server/assessment/assessment.route';
import discussionRoutes from './server/discussion/discussion.route';
import emailSubscriptionRoutes from './server/emailSubscription/route';
import linkRoutes from './server/link/link.route';
import groupRoutes from './server/group/group.route';
import codeManagement from './server/codeManagement/route';
import logRoutes from './server/log/log.route';
import auth from './server/middleware/auth';
import emailManagement from './server/emailManagement/route';
import mentors from './server/mentors/route';
import notifications from './server/notifications/route';
import payments from './server/payments/route';
import queryRoutes from './server/query/query.route';
import bucketRoutes from './server/bucket/bucket.route';
import adminRoutes from './server/admin/route';
import clientRoutes from './server/client/client.route';
import phaseRoutes from './server/phase/phase.route';
import leaderboardRoutes from './server/leaderboard/leaderboard.route';
import unauthorizedRoutes from './server/unauthorized/routes';
import migrationRoutes from './setup/migrations';
import serviceManagementRoutes from './server/serviceManagement/routes';
import videoRoutes from './server/learningCenter/routes';
import p4Routes from './server/p4/routes';
import dashboardCardRoutes from './server/dashboardCard/route';
import reportRoutes from './server/reports/route';
import assignmentRoutes from './server/assignment/route';
import batchRouter from './server/batch/routes';
import announcementRoutes from './server/announcement/route';
import statisticsRoutes from './server/statistics/routes';

import { Request } from './server/types/Request';
import forumRoutes from './server/forum/route';
import migrationsRoutes from './server/migrations/routes';
import crmRoutes from './server/crm/routes';
import shortLinkRoutes from './server/crm/shortLinks.routes';
import feedbackRouter from './server/feedback/router';
import covidVaccineRoutes from './server/covid-vaccine/route';
import attendanceRouter from './server/attendance/routes';
import analyticsRoutes from './server/analytics/analytics.route';
import addonsRoutes from './server/client-addons/routes';
import tempRoutes from './server/temp/routes';
import leaveRouter from './server/leaves/leaves.route';
import CbtTokenRoutes from './server/cbt/routes';
import superRouter from './server/super/super.routes';
import chatsRoutes from './server/chat/chats.routes';
import inventoryRouter from './server/inventory/inventory.routes';
import courseRouter from './server/courses/courses.routes';
import feesRoutes from './server/fees/fees.routes';

const router = express.Router(); // eslint-disable-line new-cap

// TODO: use glob to match *.route files

/** GET /health-check - Check service health */
router.get('/health-check', (req, res) => {
	res.json({
		serverStatus: 'OK',
		environment: process.env.NODE_ENV,
		ip: req.ip,
		hostname: req.hostname,
		remoteAddress: req.connection.remoteAddress,
		server: process.env.SERVER_NAME || 'unknown',
		isWorking: 'working',
	});
});
router.get('/auth-health-check', auth.required, (req: Request, res) => {
	res.send({
		payload: req.payload,
		server: process.env.SERVER_NAME || 'unknown',
		environment: process.env.NODE_ENV,
		ip: req.ip,
		hostname: req.hostname,
		remoteAddress: req.connection.remoteAddress,
	});
});

router.use('/set-cookie', (req, res) => {
	res
		.cookie('auth', 'yo', { maxAge: 100000 })
		.send({ message: 'Cookie should be sent' });
});
router.use('/clear-cookie', (req, res) => {
	res
		.cookie('auth', 'empty', {
			expires: new Date(0),
		})
		.send({ message: 'cookieCleared' });
});

router.use('/users', userRoutes);
router.use('/batch', batchRouter);
router.use('/session', auth.required, sessionRouter);
router.use('/questions', auth.required, questionsRoutes);
router.use('/puzzles', auth.required, puzzlesRoutes);
router.use('/topics', auth.required, topicsRoutes);
router.use('/draft', auth.required, draftRoutes);
router.use('/assessment', assessmentRoutes);
router.use('/discussion', auth.required, discussionRoutes);
router.use('/link', auth.required, linkRoutes);
router.use('/unauthorized', unauthorizedRoutes);
router.use('/group', groupRoutes);
router.use('/mentors', auth.required, mentors);
router.use('/notifications', auth.required, notifications);
router.use('/payments', payments);
router.use('/query', auth.required, queryRoutes);
router.use('/serviceManagement', serviceManagementRoutes);
router.use('/bucket', auth.required, bucketRoutes);
router.use('/clients', clientRoutes);
router.use('/phase', auth.required, phaseRoutes);
router.use('/log', auth.required, logRoutes);
router.use('/reports', auth.required, reportRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/migrations', auth.required, auth.isSuper, migrationRoutes);
router.use('/video', videoRoutes);
router.use('/p4', p4Routes);
router.use('/dashboardCard', dashboardCardRoutes);
router.use('/emailSubscription', emailSubscriptionRoutes);
router.use('/emailManagement', emailManagement);
router.use('/codeManagement', codeManagement);
router.use('/assignment', assignmentRoutes);
router.use('/covid-vaccine', covidVaccineRoutes);
router.use('/announcement', announcementRoutes);
router.use('/forum', forumRoutes);
router.use('/statistics', statisticsRoutes);
router.use('/migration', migrationsRoutes);
router.use('/crm', crmRoutes);
router.use('/feedback', feedbackRouter);
router.use('/attendance', attendanceRouter);
router.use('/inventory', inventoryRouter);
router.use('/leaves', leaveRouter);
router.use('/add-ons', addonsRoutes);
router.use('/cbt-manager', CbtTokenRoutes);
router.use('/super', auth.required, auth.isSuper, superRouter);
router.use('/chats', chatsRoutes);
router.use('/courses', courseRouter);
router.use('/fees', feesRoutes);
router.use('/temp', tempRoutes);
/**
 * moderator is the minimum required role to access admin routes
 */
router.use('/analytics', auth.required, auth.isAtLeastMentor, analyticsRoutes);
router.use('/admin', auth.required, auth.isAtLeastMentor, adminRoutes);
router.use('/shared', shortLinkRoutes);

if (process.env.NODE_ENV === 'development') {
	const devAPIs = require('./server/devAPIs/index.route').default;
	router.use('/devapis', devAPIs);
}

module.exports = router;
