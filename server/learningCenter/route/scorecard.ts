import { Router } from 'express';
import auth from '../../middleware/auth';
import { getGradesForPhase, getMyScorecard } from '../controllers/scorecard';

const scorecardRouter = Router();

scorecardRouter.route('/my').get(auth.required, getMyScorecard);
scorecardRouter
	.route('/grades/phase')
	.get(auth.required, auth.isAtLeastMentor, getGradesForPhase);

export default scorecardRouter;
