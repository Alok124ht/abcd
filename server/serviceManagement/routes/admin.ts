import { Router } from 'express';
import auth from '../../middleware/auth';
import {
	createServiceProvidersRequest,
	myServiceProvidersRequests,
	getServiceProvidersRequests,
	getMyServiceProvidersList,
	approveRequest,
} from '../controllers/admin';
import { withPhases } from '../../phase/middlewares';
import orderRouter from './adminOrder';

// eslint-disable-next-line new-cap
const router = Router();

// eslint-disable-next-line new-cap
const serviceProvidersRoutes = Router();
serviceProvidersRoutes.use(auth.required, auth.isModerator);

serviceProvidersRoutes.route('/request').post(createServiceProvidersRequest);

serviceProvidersRoutes
	.route('/my-service-providers-requests')
	.get(withPhases, myServiceProvidersRequests);
serviceProvidersRoutes
	.route('/requests')
	.get(auth.isSuper, getServiceProvidersRequests);

/**
 * ServiceProviders list for my services
 */
serviceProvidersRoutes
	.route('/my/list')
	.get(auth.isModerator, withPhases, getMyServiceProvidersList);

serviceProvidersRoutes.route('/approve').post(approveRequest);

router.use('/service-providers', serviceProvidersRoutes);

router.use('/orders', orderRouter);

export default router;
