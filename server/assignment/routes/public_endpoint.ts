import express from 'express';
import {
	getAllSubmissions,
	getSubmission,
	getUploadPolicy,
	submit,
} from '../controllers/user';

const router = express.Router();

router.route('/uploadPolicy').post(getUploadPolicy);
router.route('/submit').post(submit);
router.route('/get').get(getSubmission);
router.route('/my-submissions').get(getAllSubmissions);

export default router;
