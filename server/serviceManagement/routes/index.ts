// eslint-disable-next-line new-cap
import Router from 'express';
import userRoutes from './userServicePlan';
import sharedRoutes from './shared';
import adminRoutes from './admin';
import fileRoutes from './file';

const serviceManagementRouter = Router();

serviceManagementRouter.use('/userServicePlans', userRoutes);

serviceManagementRouter.use('/shared', sharedRoutes);

serviceManagementRouter.use('/admin', adminRoutes);

serviceManagementRouter.use('/file', fileRoutes);

export default serviceManagementRouter;
