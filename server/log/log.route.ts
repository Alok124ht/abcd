import { Router } from 'express';
import { flow } from './log.controller';

const router = Router();

router.route('/flow').post(flow);

export default router;
