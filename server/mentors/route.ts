import { Router } from 'express';
import {
	getRequestsForAdmin,
	assignMentorForRequest,
	getMyRequests,
	getRequest,
	cancelMentorRequest,
	requestMentor,
} from './controllers/requests';
import {
	getPolicyForAttachmentUpload,
	getAttachment,
	addCommentToAttachment,
	getAttachmentComments,
} from './controllers/attachments';
import {
	sendMessageToGroup,
	getMessagesOfGroup,
	getGroupsOfUser,
	markConversationAsRead,
	getGroupsHavingUpdates,
} from './controllers/messages';
import {
	getAllTypes,
	getTypes,
	createType,
	updateType,
} from './controllers/types';
import {
	hasViewPermission,
	hasCommentPermission,
} from './middlewares/attachments';
import { checkUserGroup } from './middleware';
import auth from '../middleware/auth';
import { startChatGroup } from './controllers/start';

const router = Router();

router.route('/request').post(requestMentor).get(getRequest);
router.route('/request/cancel').patch(cancelMentorRequest);
router.route('/requests').get(getMyRequests);
router.route('/types').get(getTypes);
router.route('/conversation/:groupId').post(checkUserGroup, sendMessageToGroup);
router.route('/conversation/:groupId').get(checkUserGroup, getMessagesOfGroup);
router
	.route('/conversation/:groupId/markAsRead')
	.post(checkUserGroup, markConversationAsRead);
router.route('/admin/requests').get(auth.isAdmin, getRequestsForAdmin);
router.route('/assign').post(auth.isAdmin, assignMentorForRequest);
router.route('/groups/updated').get(getGroupsHavingUpdates);
router.route('/groups').get(getGroupsOfUser);
router.route('/attachment-upload-policy').get(getPolicyForAttachmentUpload);
router
	.route('/attachment/comment')
	.post(hasCommentPermission, addCommentToAttachment);
router.route('/attachment').get(hasViewPermission, getAttachment);
router
	.route('/attachment/comments')
	.get(hasCommentPermission, getAttachmentComments);

router.route('/types/all').get(auth.isAdmin, getAllTypes);
router
	.route('/type')
	.post(auth.isAdmin, createType)
	.patch(auth.isAdmin, updateType);

router
	.route('/create-group')
	.post(auth.required, auth.createWithUser('subscriptions'), startChatGroup);

export default router;
