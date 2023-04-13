import { Router } from 'express';
import auth from '../middleware/auth';
import { createForm, listForms } from './controllers/form';
import { createFormWrapper } from './controllers/formWrapper';
import { getFeedbackFormWrapper as getFeedbackFormWrapperPublic } from './controllers/formWrapperPublic';
import { submitFeedbackFormResponse } from './controllers/response';

const feedbackRouter = Router();
feedbackRouter.use(auth.required);

feedbackRouter.route('/form/create').post(auth.isSuper, createForm);
feedbackRouter.route('/form/list').get(auth.isSuper, listForms);
feedbackRouter
	.route('/form-wrapper/create')
	.post(auth.isSuper, createFormWrapper);

feedbackRouter
	.route('/form-wrapper/public/get')
	.post(getFeedbackFormWrapperPublic);

feedbackRouter
	.route('/form/response/submit')
	.post(auth.createWithUser('subscriptions'), submitFeedbackFormResponse);

export default feedbackRouter;
