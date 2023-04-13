import { Router } from 'express';
import auth from '../middleware/auth';
import {
	addConversation,
	addMessage,
	addUserToGroup,
	assignAsAdmin,
	changeAdminOnly,
	conversationOpened,
	deleteConversation,
	deleteMessages,
	editGroupDetailsByKeyValue,
	getConversation,
	getConversations,
	getUsersAsPerAccess,
	leftGroup,
	removeAsAdmin,
	removeUserFromGroup,
	unsendMessage,
} from './chats.controller';

const chatsRoutes = Router();

chatsRoutes
	.route('/conversation')
	.post(auth.required, addConversation)
	.get(auth.required, getConversations)
	.delete(auth.required, deleteConversation);

chatsRoutes.route('/conversation/get').get(auth.required, getConversation);

chatsRoutes
	.route('/conversation/opened')
	.get(auth.required, conversationOpened);

chatsRoutes
	.route('/conversation/admin/assign')
	.get(auth.required, assignAsAdmin);

chatsRoutes
	.route('/conversation/admin/remove')
	.get(auth.required, removeAsAdmin);

chatsRoutes
	.route('/conversation/group/add-user')
	.get(auth.required, addUserToGroup);

chatsRoutes
	.route('/conversation/group/remove-user')
	.get(auth.required, removeUserFromGroup);

chatsRoutes
	.route('/conversation/group/change-admin-only')
	.get(auth.required, changeAdminOnly);

chatsRoutes
	.route('/conversation/group/update-by-key')
	.post(auth.required, editGroupDetailsByKeyValue);

chatsRoutes.route('/conversation/group/left').get(auth.required, leftGroup);

chatsRoutes.route('/message').post(auth.required, addMessage);

chatsRoutes.route('/message/delete').post(auth.required, deleteMessages);

chatsRoutes.route('/message/unsend').post(auth.required, unsendMessage);

chatsRoutes.route('/get-users').get(auth.required, getUsersAsPerAccess);

export = chatsRoutes;
