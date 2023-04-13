import express from 'express';
import { add, addToBucket, removeFromBucket } from './bucket.controller';

const router = express.Router(); // eslint-disable-line new-cap

router.route('/add').post(add);

router.route('/add-to-bucket').post(addToBucket);

router.route('/remove-from-bucket').post(removeFromBucket);

export default router;
