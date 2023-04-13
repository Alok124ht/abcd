import { Router } from 'express';
import { withAdminPermission } from '../../admin/permissions/middlewares';
import { withPhases } from '../../phase/middlewares';
import {
	createAnnouncement,
	listAnnouncements,
	updateAnnouncement,
} from '../controllers/crud';
import { getUploadPolicy } from '../controllers/file';

const router = Router();

router.use(withPhases, withAdminPermission);

router.route('/create').post(createAnnouncement);
router.route('/update').patch(updateAnnouncement);
router.route('/list').get(listAnnouncements);
router.route('/file-upload-policy').post(getUploadPolicy);

export default router;
