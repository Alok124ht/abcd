import { Router } from 'express';
import { getCoursePlanOfPhase } from '../controllers/coursePlan';

const router = Router();

router.route('/of-phase/:phaseId').get(getCoursePlanOfPhase);

export default router;
