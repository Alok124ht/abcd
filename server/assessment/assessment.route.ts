import express from 'express';
import assessmentCtrl, {
	getAssementSubmissionDetails,
	getAssessmentCores,
	getRandomQuestion,
	getUsersWhoStartedAssessment,
	getWrapperFormat,
	getWrappersScheduledToday,
} from './assessment.controller';
import middlewares from './middlewares';
import auth from '../middleware/auth';
import groupAssessmentCtrl from './group.controller';
import {
	appendSubmissionsToAnalysis,
	createSubmissionFromFlow,
	submitAssessmentResponse,
	uploadCbtResponse,
} from './controllers/submission';
import { withUserGroups } from '../user/middlewares';
import { withPhases } from '../phase/middlewares';
import { startAssessment } from './controllers/start';
import { syncFlow } from './controllers/progress';
import { updateConfig, updateMarkingScheme } from './controllers/modifyCore';
import {
	addPhase,
	addWrapper,
	removePhase,
	updateOnlyCBT,
} from './controllers/wrapperPublishing';
import { updateTags } from './controllers/modifyWrapper';
import { listCoresAdmin } from './controllers/admin/list';
import assessmentAdminRouter from './admin.routes';

const router = express.Router(); // eslint-disable-line new-cap

/*
 * APIs which dont need user's (admins or user) data.
 */

router
	.route('/getwrappers/:phase')
	.get(auth.required, assessmentCtrl.getwrappers);

router.route('/getwrapper/:wrapperId').get(assessmentCtrl.getwrapper);

// User is optional, for logged in users it sends extra data.
router
	.route('/getassessment/:wrapperId')
	.get(
		auth.optional,
		middlewares.withAccessState,
		assessmentCtrl.getassessmentwrapper
	);

// 1 hr cache
router
	.route('/getwrappertoppers/:wrapperId')
	.get(assessmentCtrl.getwrappertoppers);

/* END */

// ________________________________________

/*
 * APIs which need only admin's data.
 */
router.use('/admin', assessmentAdminRouter);
router.route('/update').post(auth.required, assessmentCtrl.update);
router
	.route('/update-only-cbt')
	.post(auth.required, auth.isModerator, updateOnlyCBT);
router
	.route('/update-core-config')
	.post(auth.required, auth.isModerator, updateConfig);
router
	.route('/update-core-marking-scheme')
	.post(auth.required, auth.isModerator, updateMarkingScheme);

router
	.route('/updatePreAnalysis')
	.post(auth.required, assessmentCtrl.updatePreAnalysis);

router
	.route('/updateDates')
	.post(auth.required, auth.isModerator, assessmentCtrl.updateDates);

router
	.route('/update-section-instructions')
	.post(auth.required, assessmentCtrl.updateSectionInstructions);

router
	.route('/update-custom-syllabus')
	.post(auth.required, assessmentCtrl.updateCustomSyllabus);

router
	.route('/update-section-names')
	.post(auth.required, auth.isModerator, assessmentCtrl.updateSectionNames);

router
	.route('/update-core-duration')
	.post(auth.required, auth.isModerator, assessmentCtrl.upadteDuration);
router
	.route('/update-core-identifier')
	.post(auth.required, auth.isModerator, assessmentCtrl.updateIdentifier);

router.route('/updateBonus').post(auth.required, assessmentCtrl.updateBonus);

router
	.route('/view/:assessmentId')
	.get(auth.required, auth.isModerator, withPhases, assessmentCtrl.view);

router
	.route('/gradeSubmissions')
	.post(auth.required, auth.isAdmin, assessmentCtrl.gradeSubmissions);

router
	.route('/categorizeCore/:coreId')
	.get(auth.required, assessmentCtrl.categorizeCore);

router
	.route('/automatedAssessment')
	.post(auth.required, auth.isAdmin, assessmentCtrl.automatedAssessment);

router
	.route('/list/cores/:superGroup')
	.get(auth.required, auth.isAtLeastMentor, listCoresAdmin);

router
	.route('/gradecore/:coreId')
	.get(auth.required, auth.isAtLeastMentor, assessmentCtrl.gradeCore);

router
	.route('/submission/mark-not-graded')
	.get(assessmentCtrl.markSubmissionAsNotGraded);

router
	.route('/fixsyllabus/:coreId')
	.get(auth.required, assessmentCtrl.fixsyllabus);

router
	.route('/gradewrapper/:wrapperId')
	.get(auth.required, auth.isAtLeastMentor, assessmentCtrl.gradewrapper);

router
	.route('/reset-wrapper-analysis/:wrapperId')
	.get(auth.required, assessmentCtrl.resetWrapperAnalysis);

router
	.route('/archivewrapper/:wrapperId')
	.get(auth.required, auth.isModerator, assessmentCtrl.archivewrapper);

router
	.route('/archivecore/:coreId')
	.get(auth.required, assessmentCtrl.archivecore);

router
	.route('/getmarks/:wrapperId')
	.get(auth.required, assessmentCtrl.getmarks);

router.route('/addwrapper').post(auth.required, auth.isModerator, addWrapper);
router.route('/addphase').post(auth.required, addPhase);
router
	.route('/removephase')
	.post(auth.required, auth.isModerator, withPhases, removePhase);

router
	.route('/update-client')
	.post(auth.required, auth.isAdmin, assessmentCtrl.updateClient);
router
	.route('/update-services')
	.post(
		auth.required,
		auth.isModerator,
		withPhases,
		assessmentCtrl.updateServices
	);

router
	.route('/update-prequel-and-sequel')
	.patch(auth.required, auth.isModerator, assessmentCtrl.updatePrequelAndSequel);

router
	.route('/update-grade-time')
	.post(auth.required, auth.isModerator, assessmentCtrl.updateGradeTime);

router
	.route('/migrateleaderboard2')
	.post(auth.required, assessmentCtrl.migrateleaderboard2);

router
	.route('/toggle-hide/:wrapperId')
	.get(auth.required, auth.isModerator, assessmentCtrl.toggleHide);

router.route('/wrapper/tags').patch(updateTags);

/* END */

// ________________________________________

/*
 * APIs which need user's data - specfic to user.
 */

router
	.route('/submit')
	.post(auth.required, middlewares.isResponseValid, submitAssessmentResponse);

router
	.route('/upload-local-response')
	.post(auth.required, auth.isAtLeastMentor, uploadCbtResponse);

router.route('/getGrades').post(auth.required, assessmentCtrl.getGrades);

router.route('/getAnalysis').post(auth.required, assessmentCtrl.getAnalysis);

// Dont update this. Present in aws lambda too!! So make sure to update both.
router
	.route('/syncFlow')
	.post(
		auth.required,
		middlewares.isFlowValid,
		middlewares.withUserLiveAssessment,
		syncFlow
	);

router
	.route('/getsubmissions')
	.post(auth.required, assessmentCtrl.getsubmissions);

/* END */

// router.route("/bulk")
// .post(questionCtrl.createMany)

// router.route('/list/completed').get(assessmentCtrl.listCompleted);

// router.route('/rateQuestions').post(auth.required, assessmentCtrl.questionRatingData);

router
	.route('/my/wrappers')
	.get(auth.required, groupAssessmentCtrl.getMyAssessments);
router
	.route('/addGroupToAssessment')
	.post(
		auth.required,
		auth.isModerator,
		groupAssessmentCtrl.addGroupToAssessmentWrapper
	);

router
	.route('/createSubmissionFromFlow')
	.post(auth.required, auth.isModerator, createSubmissionFromFlow);

router
	.route('/:assessmentId')
	.get(
		auth.required,
		withUserGroups,
		middlewares.isAccessAllowed,
		startAssessment
	);

router.route('/get/format/:assessmentId').get(auth.required, getWrapperFormat);

router
	.route('/generate/questions')
	/*
		topic: string, required;
		sub_topic: string[], required;
		type: string[], optional;
		level: number[], optional;
		specific: [{
			type: string, required;
			questions: number, required
		}], optional;
	*/
	.post(auth.required, getRandomQuestion);

router
	.route('/getSubmissionDetails')
	.post(auth.required, getAssementSubmissionDetails);

router.route('/get-cores').post(auth.required, getAssessmentCores);

router
	.route('/append-submissions/:submission')
	.get(auth.required, appendSubmissionsToAnalysis);

router
	.route('/get-users-who-started-assessment/:wrapper')
	.get(auth.required, getUsersWhoStartedAssessment);

router
	.route('/get-todays-wrappers')
	.get(auth.required, getWrappersScheduledToday);

router
	.route('/update-wrapper-name/:wrapper')
	.post(auth.required, assessmentCtrl.updateWrapperName);

export default router;
