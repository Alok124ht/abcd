import { Router } from 'express';
import { create, list, listPhasePermissions } from './controllers/crud';
import { withAdminPermission } from './middlewares';

const router = Router();

router.route('/create').post(create);
router.route('/list/:phaseId').get(withAdminPermission, listPhasePermissions);
router.route('/list').get(withAdminPermission, list);

export default router;
