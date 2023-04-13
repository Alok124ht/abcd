import { Router } from 'express';
import { handleShortLinkRedirect } from './controllers/redirector';

const shortLinkRoutes = Router();

shortLinkRoutes.route('/:key').get(handleShortLinkRedirect);

export default shortLinkRoutes;
