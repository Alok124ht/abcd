import { Router } from 'express';
import auth from '../middleware/auth';
import {
	postQuestion,
	listRecent,
	postAnswer,
	getQuestion,
	postComment,
} from './controllers/crud';
import { getUploadPolicy } from './controllers/file';

const forumRoutes = Router();

forumRoutes
	.route('/post/question')
	.post(auth.required, auth.createWithUser('subscriptions'), postQuestion);
forumRoutes
	.route('/post/answer')
	.post(auth.required, auth.createWithUser('subscriptions'), postAnswer);
forumRoutes
	.route('/post/comment')
	.post(auth.required, auth.createWithUser('subscriptions'), postComment);

forumRoutes.route('/list/:phase/:subject/:skip/:limit').get(listRecent);
forumRoutes
	.route('/get/question/:question')
	.get(auth.required, auth.createWithUser('subscriptions'), getQuestion);
forumRoutes.route('/file-upload-policy').post(auth.required, getUploadPolicy);

export default forumRoutes;
