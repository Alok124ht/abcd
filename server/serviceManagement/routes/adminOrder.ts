import { Router } from 'express';
import auth from '../../middleware/auth';
import { listOrders } from '../controllers/adminOrders';

const orderRouter = Router();
orderRouter.use(auth.required, auth.isModerator, auth.withClientOptional);

orderRouter.route('/list').get(listOrders);

export default orderRouter;
