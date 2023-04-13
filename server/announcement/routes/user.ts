import { Router } from 'express';
import { getAnnouncement, getAnnouncements } from '../controllers/user';

const router = Router();
router.route('/of-phase/:phase/:skip/:limit').get(getAnnouncements);
router.route('/item/:announcementId').get(getAnnouncement);

export default router;
