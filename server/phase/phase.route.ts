import { Router } from 'express';
import {
	addphase,
	addphaseNew,
	getrequests,
	grantaccess,
	revokeUserAccess,
	updateusers,
	getUEReport,
	getUsersInPhase,
} from './phase.controller';
import { withPhases, createWithUserSearch } from './middlewares';
import auth from '../middleware/auth';
import { withAdminPermission } from '../admin/permissions/middlewares';
import phaseMentorRouter from './routes/mentor';
import { getPhases, updatePhase } from './controllers/admin/crud';

const phaseRouter = Router();

phaseRouter.use('/mentor', phaseMentorRouter);

phaseRouter
	.route('/get')
	.get(auth.isAtLeastMentor, withAdminPermission, getPhases);
phaseRouter.route('/addphase').post(addphase);
phaseRouter.route('/addphase-new').post(addphaseNew);
phaseRouter.route('/updatephase').post(auth.isModerator, updatePhase);

phaseRouter.route('/getrequests/:phase').get(getrequests);
phaseRouter.route('/grantaccess').post(grantaccess);
phaseRouter
	.route('/revoke-access')
	.post(
		withPhases,
		auth.isModerator,
		createWithUserSearch({ subscriptions: 1 }),
		revokeUserAccess
	);

phaseRouter.route('/updateusers/:phase').get(updateusers);

phaseRouter.route('/getuereport/:phase').get(getUEReport);
phaseRouter.route('/users/:phase').get(getUsersInPhase);

export default phaseRouter;
