import { Router } from 'express';
import { withAdminPermission } from '../../admin/permissions/middlewares';
import {
	addMentorToPhase,
	getMentorsOfPhase,
	removeMentorFromPhase,
} from '../controllers/mentor/admin';
import { getMentorsOfPhase as getMentorsOfPhasePublic } from '../controllers/mentor/public';
import { withPhases } from '../middlewares';

const phaseMentorRouter = Router();

const adminRoutes = Router();
phaseMentorRouter.use('/admin', adminRoutes);
adminRoutes.use(withPhases, withAdminPermission);
adminRoutes.route('/add/:phaseId').post(addMentorToPhase);
adminRoutes.route('/remove').delete(removeMentorFromPhase);
adminRoutes.route('/list/:phaseId').get(getMentorsOfPhase);

const publicRoutes = Router();
phaseMentorRouter.use('/public', publicRoutes);
publicRoutes.route('/get/:phaseId').get(getMentorsOfPhasePublic);

export default phaseMentorRouter;
