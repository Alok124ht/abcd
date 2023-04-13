import { Router } from 'express';
import auth from '../middleware/auth';
import { addFees, getFeeDetails, getFees } from './fees.controller';

const feesRoutes = Router();

feesRoutes.use(auth.required, auth.isAtLeastMentor);

feesRoutes.route('').get(getFees).post(addFees);
feesRoutes.route('/single').get(getFeeDetails);

export = feesRoutes;
