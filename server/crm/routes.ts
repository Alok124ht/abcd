import { Router } from 'express';
import auth from '../middleware/auth';
import { createShortLink, getShortLinks } from './controllers/links';

const crmRoutes = Router();
crmRoutes.use(auth.required, auth.isAtLeastMentor);

const shortLinkRoutes = Router();
shortLinkRoutes.route('/create').post(createShortLink);
shortLinkRoutes.route('/list').get(getShortLinks);

crmRoutes.use('/shortLink', shortLinkRoutes);

export default crmRoutes;
