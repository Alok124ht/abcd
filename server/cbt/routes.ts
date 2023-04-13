import Router from 'express';
import auth from '../middleware/auth';
import { generate, diasbleToken } from './controllers/basic';
import { validateToken } from './middleware/cbttokens.middleware';
import {
	getPhases,
	getSupergroups,
	getSubgroups,
	getUsers,
	getCore,
	getQuestions,
	getSubjects,
	submitAssessment,
	getWrappers,
} from './controllers/remote';

const CbtTokenRoutes = Router();

CbtTokenRoutes.route('/generate-token').post(
	auth.required,
	auth.isSuper,
	generate
);

CbtTokenRoutes.route('/disable-token').post(
	auth.required,
	auth.isSuper,
	diasbleToken
);

CbtTokenRoutes.route('/get-phases').post(validateToken, getPhases);

CbtTokenRoutes.route('/get-subgroups').post(validateToken, getSubgroups);

CbtTokenRoutes.route('/get-supergroups').post(validateToken, getSupergroups);

CbtTokenRoutes.route('/get-users').post(validateToken, getUsers);

CbtTokenRoutes.route('/get-subjects').post(validateToken, getSubjects);

CbtTokenRoutes.route('/get-wrappers').post(validateToken, getWrappers);

CbtTokenRoutes.route('/get-core').post(getCore);

CbtTokenRoutes.route('/get-questions').post(getQuestions);

CbtTokenRoutes.route('/submit-assessment').post(
	validateToken,
	submitAssessment
);

export default CbtTokenRoutes;
