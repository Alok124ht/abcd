import express from 'express';
import {
	createAssignment,
	listAssignments,
	getUploadPolicy,
	listSubmissions,
	setGradesForSubmission,
	updateAssignment,
	getGradesGraphData,
	getUserGrades,
} from '../controllers/admin/crud';
import { hasAccessToAssignment } from '../middlewares';

const router = express.Router();

router.route('/createAssignment').post(createAssignment);

router.route('/updateAssignment').patch(updateAssignment);

router.route('/listAssignments').get(listAssignments);

router.route('/uploadPolicy').post(getUploadPolicy);

router.route('/submissions').get(hasAccessToAssignment, listSubmissions);

router
	.route('/submission/setGrades')
	.post(hasAccessToAssignment, setGradesForSubmission);

router.route('/gradesGraph').get(getGradesGraphData);

router.route('/userGrades').get(getUserGrades);

export default router;
