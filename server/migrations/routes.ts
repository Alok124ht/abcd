import { Router } from 'express';
import auth from '../middleware/auth';
import { migrateFromUserCategory } from './controllers/submissionKPI';

const migrationsRoutes = Router();
migrationsRoutes.use(auth.required, auth.isSuper);

migrationsRoutes
	.route('/user-category-to-submission-kpi')
	.post(migrateFromUserCategory);

export default migrationsRoutes;
