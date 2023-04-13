import express from 'express';
import auth from '../middleware/auth';
import groupCtrl from '../group/group.controller';
import visitorCtrl from './visitor.controller';
import examsCtrl from './exams.controller';
import { subscribe } from './emailSubscription.controller';
import { submit, getImageUploadPolicy } from './feedback';
import {
	addCouseQueryDetails,
	applyForCourse,
	getBasicDetails,
	getCVUploadPolicy,
	submitBasicDetails,
	submitStep2Details,
} from './course';
import { getAllSubjects } from './subject';
import { getLogoUploadPolicy, registerCoaching } from './coaching';
import { recordSystemReport } from './controllers/systemReport';
import { getTeamEmails } from './controllers/captchaProtected';

const router = express.Router(); // eslint-disable-line new-cap

router.route('/super-groups').get(groupCtrl.listForUnauthorized);
router.route('/cvis').get(visitorCtrl.createVisitor);

router.route('/iift').post(examsCtrl.iift);

router.route('/subscribe').post(subscribe);

router.route('/feedback/submit').post(auth.optional, submit);

router.route('/feedback/image-upload-policy').get(getImageUploadPolicy);

router.route('/course/cv-upload-policy').get(getCVUploadPolicy);
router.route('/course/apply').post(applyForCourse);
router.route('/course/query').post(addCouseQueryDetails);
router.route('/course/submit-basic-details').post(submitBasicDetails);
router.route('/course/submit-step2-details').post(submitStep2Details);
router.route('/course/basic-details').get(getBasicDetails);
router.route('/subject/list').get(getAllSubjects);

router.route('/coaching/logo-upload-policy').get(getLogoUploadPolicy);
router.route('/coaching/register-for-demo').post(registerCoaching);
router.route('/submit-system-report').post(auth.optional, recordSystemReport);
router.route('/get-team-emails').post(getTeamEmails);

export default router;
