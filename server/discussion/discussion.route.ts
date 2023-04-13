import { Router } from 'express';
import {
	comment,
	reply,
	upvote,
	downvote,
	removeupvote,
	removedownvote,
	get,
	deleteComment,
	deleteReply,
	editComment,
	editReply,
	requestSolution,
	notifySolution,
	getRequests,
	acceptSolution,
	getRequest,
	getSolutionRequest,
	submitSolution,
} from './discussion.controller';

const router = Router(); // eslint-disable-line new-cap

router.route('/comment').post(comment);

router.route('/reply').post(reply);

router.route('/upvote').post(upvote);

router.route('/downvote').post(downvote);

router.route('/removeupvote').post(removeupvote);

router.route('/removedownvote').post(removedownvote);

router.route('/:questionId').get(get);

router.route('/deleteComment').post(deleteComment);

router.route('/deleteReply').post(deleteReply);

router.route('/editComment').post(editComment);

router.route('/editReply').post(editReply);

router.route('/requestSolution').post(requestSolution);

router.route('/notifySolution').post(notifySolution);

router.route('/getrequests').post(getRequests);

router.route('/acceptSolution').post(acceptSolution);

router.route('/getrequest/:requestId').post(getRequest);

router.route('/get-solution-request').post(getSolutionRequest);
router.route('/submit-solution').post(submitSolution);

export default router;
