import { Router } from 'express';
import {
	getUserMarks,
	getUserInPhase,
	overallAnalysis,
	overallAnalysisPhase,
	getUserData,
	userVideoStats,
	getFullAssessments,
	userAssessmentStats,
} from './controller';

const analyticsRoutes = Router();

analyticsRoutes.route('/assessment/marks/:assessmentId').get(getUserMarks);

analyticsRoutes.route('/assessment/getUser/:phase').get(getUserInPhase);

analyticsRoutes.route('/assessment/overall/user').post(overallAnalysis);

analyticsRoutes.route('/assessment/overall/phase').post(overallAnalysisPhase);

analyticsRoutes.route('/user/getData/:userId').get(getUserData);

analyticsRoutes
	.route('/user/fullAssessmentData/:userId')
	.post(getFullAssessments);

analyticsRoutes.route('/dashboard/video-stats').get(userVideoStats);

analyticsRoutes.route('/dashboard/assessment-stats').get(userAssessmentStats);

export default analyticsRoutes;
