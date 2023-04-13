import { forEach, get, isArray, toNumber, toString } from 'lodash';
import UserModel from '../user/user.model';
import ConversationModel from './models/conversations.model';
import MessagesModel from './models/messages.model';
import { UserInConversation } from './types/conversations';
import PhaseMentorModel from '../phase/PhaseMentor';
import ClientModel from '../client/client.model';

export const addConversation = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id } = req.payload;
		const { users, isGroup: groupFromRequest, name } = req.body;

		let isGroup = groupFromRequest;

		if (!users || !isArray(users) || users.length === 0 || (isGroup && !name)) {
			res.send({ success: false, msg: 'Please send appropriate data' });
			return;
		}

		if (!groupFromRequest) {
			isGroup = false;
		}

		if (!isGroup) {
			const oldConversations = await ConversationModel.find({
				'users.user': id,
				isGroup: false,
			}).select('users');
			let conversation = -1;
			forEach(oldConversations, (chat) => {
				forEach(chat.users, (user) => {
					if (toString(user.user) === users[0]) {
						conversation = chat._id;
						return;
					}
				});
				if (conversation !== -1) {
					return;
				}
			});
			if (conversation !== -1) {
				res.send({
					success: true,
					msg: 'Old Conversation found',
					id: conversation,
					type: 'old',
					messages: [],
				});
				return;
			}
		}

		const convertedUsers = [{ user: id, isAdmin: true }];
		forEach(users, (user) => {
			convertedUsers.push({ user: user, isAdmin: !isGroup });
		});

		const newConversation = new ConversationModel({
			users: convertedUsers,
			name,
			createdBy: id,
			isGroup,
		});
		newConversation.save((err, saved) => {
			if (saved)
				res.send({
					success: true,
					msg: 'Conversation created',
					id: saved._id,
					type: 'new',
				});
			else res.send({ success: false, msg: 'Failed to create new Conversation' });
		});
	} catch (err) {
		res.send({ success: false, msg: 'Some error occured' });
	}
};

export const getConversations = (req: ExpressRequest, res: ExpressResponse) => {
	const { id, role } = req.payload;

	const extraQuery: any = {};

	if (role !== 'admin' && role !== 'super') {
		extraQuery.isArchived = { $ne: true };
	}

	ConversationModel.find({
		'users.user': id,
		...extraQuery,
		temporaryDeletedFor: { $ne: id },
	})
		.populate({ path: 'users.user', select: 'name username email mobile dp' })
		.then((conversations) => {
			res.send({ success: true, conversations });
		})
		.catch((err) => {
			res.send({ success: true, msg: 'Error while loading conversation' });
		});
};

export const deleteConversation = (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id } = req.query;
	const { id: userId } = req.payload;

	if (!id) {
		res.send({ success: false, msg: 'Id is not sent!' });
		return;
	}

	MessagesModel.updateMany(
		{ conversation: id, deletedFor: { $ne: userId } },
		{ $push: { deletedFor: userId } }
	)
		.then((updated) => {
			ConversationModel.updateOne(
				{ _id: id },
				{ $push: { temporaryDeletedFor: userId } }
			)
				.then((update) => {
					res.send({ success: true, msg: 'Successfully deleted!' });
				})
				.catch((err) => {
					res.send({ success: false, msg: 'Unable to delete conversation' });
				});
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Unable to delete conversation' });
		});
};

export const getConversation = (req: ExpressRequest, res: ExpressResponse) => {
	const { id: userId, role } = req.payload;
	let { id, limit, skip } = req.query;

	if (!id) {
		res.send({ success: false, msg: 'Conversation Id not send' });
		return;
	}

	const isAdmin = role === 'admin' || role === 'super';
	const extraQuery: any = {};

	if (!isAdmin) extraQuery.isArchived = false;

	if (!limit) limit = '50';
	if (!skip) skip = '0';

	MessagesModel.find({
		conversation: id,
		...extraQuery,
		deletedFor: { $ne: userId },
	})
		.populate({
			path: 'sender',
			select: 'name',
		})
		.skip(toNumber(skip))
		.limit(toNumber(limit))
		.sort({ createdAt: -1 })
		.then((messages) => {
			res.send({ success: true, messages });
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while loading messages' });
		});
};

export const addMessage = (req: ExpressRequest, res: ExpressResponse) => {
	const { id: conversation, text } = req.body;
	const { id: sender } = req.payload;

	if (!conversation || !text) {
		res.send({ success: false, msg: 'Please send proper parameters' });
		return;
	}

	const newMessage = new MessagesModel({
		conversation,
		text,
		sender,
		readBy: [sender],
	});

	newMessage.save(async (err, saved) => {
		if (saved) {
			const conversation = await ConversationModel.findById(
				saved.conversation
			).select('isGroup');
			const temporaryDeletedFor: any[] = [];
			if (conversation.isGroup) {
				forEach(conversation.users, (users) => {
					temporaryDeletedFor.push(users.user);
				});
			}

			ConversationModel.updateOne(
				{ _id: conversation },
				{ $pop: { temporaryDeletedFor } }
			);
			res.send({ success: true, msg: 'Message sent!' });
		} else {
			res.send({ success: false, msg: 'Failed to sent!' });
		}
	});
};

export const unsendMessage = (req: ExpressRequest, res: ExpressResponse) => {
	const { id: messageId } = req.query;

	if (!messageId) {
		res.send({ success: false, msg: 'Id is not sent' });
		return;
	}

	MessagesModel.updateOne({ _id: messageId }, { $set: { isArchived: true } })
		.then((updated) => res.send({ success: true, message: 'Message Unsent!' }))
		.catch(() =>
			res.send({ success: false, msg: 'Error while unsending message' })
		);
};

export const deleteMessages = (req: ExpressRequest, res: ExpressResponse) => {
	const { id } = req.payload;
	const { messages } = req.body;

	if (!messages || !isArray(messages) || messages.length === 0) {
		res.send({ success: false, msg: 'Please send proper parameters' });
		return;
	}

	MessagesModel.updateMany(
		{ _id: { $in: messages } },
		{ $push: { deletedFor: id } }
	)
		.then((updated) => res.send({ success: true, msg: 'Messages removed' }))
		.catch(() =>
			res.send({ success: false, msg: 'Error while removing messages' })
		);
};

export const conversationOpened = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: conversation } = req.query;
	const { id: userId } = req.payload;

	MessagesModel.updateMany({ conversation }, { $push: { readBy: userId } })
		.then((updated) => res.send({ success: true }))
		.catch(() => res.send({ success: false }));
};

export const getUsersAsPerAccess = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id, role } = req.payload;
	const { phase } = req.query;
	let toFind: string[] = [];

	if (!phase) {
		res.send({ success: false, msg: 'Phase not sent!' });
		return;
	}

	const phases = [toString(phase)];

	if (role === 'mentor' || role === 'moderator') {
		toFind = ['user', 'mentor', 'moderator', 'parent'];
		if (role == 'mentor') {
			const p = await PhaseMentorModel.find({ user: id });
			if (!p || p.length === 0)
				return res.send({
					success: false,
					msg: "You don't have phase permissions!",
				});
			forEach(p, (ph) => {
				phases.push(toString(ph.phase));
			});
		} else {
			const client = await ClientModel.findOne({ moderators: id });
			if (!client)
				return res.send({
					success: false,
					msg: "You don't have client permissions!",
				});
			forEach(get(client, 'phases', []), (ph) => {
				phases.push(toString(ph));
			});
		}
	}
	if (role === 'user' || role === 'parent') {
		toFind = ['mentor'];
	}

	UserModel.find({
		'subscriptions.subgroups.phases.phase': { $in: phases },
		role: { $in: toFind },
	})
		.select('name username dp email mobile')
		.then((users) => res.send({ success: true, users }))
		.catch((err) =>
			res.send({ success: false, msg: 'Error while fetching users' })
		);
};

const isUserIsAGroupAdmin = (
	admin: string,
	usersArray: UserInConversation[]
) => {
	let result = false;
	forEach(usersArray, (users) => {
		if (toString(users.user) === toString(admin)) {
			if (users.isAdmin) {
				result = true;
				return;
			}
		}
	});
	return result;
};

export const assignAsAdmin = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId } = req.payload;
		const { id: conversation, user: userToAssign } = req.query;

		if (!conversation || !userToAssign) {
			res.send({ success: false, msg: 'Please send proper parameters' });
			return;
		}

		const oldConversation = await ConversationModel.findById(conversation);
		if (oldConversation) {
			const isAdmin = isUserIsAGroupAdmin(toString(userId), oldConversation.users);
			if (isAdmin) {
				const users: UserInConversation[] = [];
				forEach(oldConversation.users, (user) => {
					if (toString(user.user) === userToAssign) {
						user.isAdmin = true;
					}
					users.push(user);
				});
				ConversationModel.updateOne({ _id: conversation }, { $set: { users } })
					.then((updated) =>
						res.send({ success: true, msg: 'User has admin access now' })
					)
					.catch(() => res.send('Enable to update accesss'));
			} else {
				res.send({
					success: false,
					msg: "You don't have access to assign/remove admin",
				});
			}
		} else {
			res.send({ success: false, msg: 'Conversation not found!' });
		}
	} catch {
		res.send({ success: false, msg: 'Some error occured' });
	}
};

export const removeAsAdmin = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId } = req.payload;
		const { id: conversation, user: userToRemove } = req.query;

		if (!conversation || !userToRemove) {
			res.send({ success: false, msg: 'Please send proper parameters' });
			return;
		}
		const oldConversation = await ConversationModel.findById(conversation);
		if (oldConversation) {
			const isAdmin = isUserIsAGroupAdmin(toString(userId), oldConversation.users);
			if (isAdmin) {
				const users: UserInConversation[] = [];
				forEach(oldConversation.users, (user) => {
					if (toString(user.user) === userToRemove) {
						user.isAdmin = false;
					}
					users.push(user);
				});
				ConversationModel.updateOne({ _id: conversation }, { $set: { users } })
					.then((updated) =>
						res.send({ success: true, msg: 'User admin access has removed' })
					)
					.catch(() => res.send('Enable to update accesss'));
			} else {
				res.send({
					success: false,
					msg: "You don't have access to assign/remove admin",
				});
			}
		} else {
			res.send({ success: false, msg: 'Conversation not found!' });
		}
	} catch {
		res.send({ success: false, msg: 'Some error occured' });
	}
};

export const addUserToGroup = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId } = req.payload;
		const { id: conversation, user: userToAdd } = req.query;

		if (!conversation || !userToAdd) {
			res.send({ success: false, msg: 'Please send proper parameters' });
			return;
		}
		const oldConversation = await ConversationModel.findById(conversation);
		if (oldConversation) {
			const isAdmin = isUserIsAGroupAdmin(toString(userId), oldConversation.users);
			if (isAdmin) {
				ConversationModel.updateOne(
					{ _id: conversation },
					{ $push: { users: { user: userToAdd, isAdmin: false } } }
				)
					.then((updated) => {
						MessagesModel.updateMany(
							{ conversation },
							{ $push: { deletedFor: userToAdd } }
						)
							.then((updated) =>
								res.send({ success: true, msg: 'User admin access has removed' })
							)
							.catch(() => res.send('Enable to hide messages for user'));
					})
					.catch(() => res.send('Enable to add user'));
			} else {
				res.send({
					success: false,
					msg: "You don't have access to assign/remove admin",
				});
			}
		} else {
			res.send({ success: false, msg: 'Conversation not found!' });
		}
	} catch {
		res.send({ success: false, msg: 'Some error occured' });
	}
};

export const removeUserFromGroup = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId } = req.payload;
		const { id: conversation, user: userToRemove } = req.query;

		if (!conversation || !userToRemove) {
			res.send({ success: false, msg: 'Please send proper parameters' });
			return;
		}
		const oldConversation = await ConversationModel.findById(conversation);
		if (oldConversation) {
			const isAdmin = isUserIsAGroupAdmin(toString(userId), oldConversation.users);
			if (isAdmin) {
				const newUsers: UserInConversation[] = [];
				forEach(oldConversation.users, (user) => {
					if (toString(user.user) !== userToRemove) newUsers.push(user);
				});
				ConversationModel.updateOne(
					{ _id: conversation },
					{
						$set: { users: newUsers },
						$push: { temporaryDeletedFor: userToRemove },
					}
				)
					.then((updated) =>
						res.send({ success: true, msg: 'User removed from group' })
					)
					.catch(() => res.send('Enable to add user'));
			} else {
				res.send({
					success: false,
					msg: "You don't have access to assign/remove admin",
				});
			}
		} else {
			res.send({ success: false, msg: 'Conversation not found!' });
		}
	} catch {
		res.send({ success: false, msg: 'Some error occured' });
	}
};

export const changeAdminOnly = (req: ExpressRequest, res: ExpressResponse) => {
	const { status, id: _id } = req.query;

	if (
		!(status === 'true' || status === 'false' || status === '1' || status === '0')
	) {
		res.send({ success: false, msg: 'Invalid status parameter' });
		return;
	}

	let adminOnly = false;

	if (status === 'true' || status === '1') adminOnly = true;
	else adminOnly = false;

	ConversationModel.updateOne({ _id }, { $set: { adminOnly } })
		.then((updated) => res.send({ success: true, msg: 'Setting Changed' }))
		.catch(() => res.send({ success: false, msg: 'Failed to change setting' }));
};

export const leftGroup = async (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const { id: conversationId } = req.query;
		const { id: userId } = req.payload;
		if (!conversationId) {
			res.send({ success: false, msg: 'Conversation Id not send!' });
			return;
		}
		const conversation = await ConversationModel.findById(
			conversationId
		).populate({ path: 'users.user', select: 'role' });
		if (conversation) {
			const isUserAdmin = isUserIsAGroupAdmin(userId, conversation.users);
			const newUsers: UserInConversation[] = [];
			forEach(conversation.users, (user) => {
				if (toString(user.user._id) !== userId) newUsers.push(user);
			});
			let anyAdmin = false;
			if (isUserAdmin) {
				forEach(newUsers, (user) => {
					if (user.isAdmin === true) {
						anyAdmin = true;
						return;
					}
				});
				if (!anyAdmin) {
					forEach(newUsers, (user) => {
						if (user.user.role === 'moderator' || user.user.role === 'mentor') {
							user.isAdmin = true;
							return;
						}
					});
				}
			}
			forEach(newUsers, (user) => {
				user.user = user.user._id;
			});

			const extraQuery: any = {};
			if (!anyAdmin) {
				const userExist = (user: any) => {
					let result = false;
					forEach(conversation.temporaryDeletedFor, (usser) => {
						if (usser === user) result = true;
						if (result) return result;
					});
					return result;
				};

				const newDeletedFor = conversation.temporaryDeletedFor;
				forEach(newUsers, (user) => {
					const exist = userExist(user.user);
					if (!exist) {
						newDeletedFor.push(user.user);
					}
				});
				extraQuery.temporaryDeletedFor = newDeletedFor;
			}

			ConversationModel.updateOne(
				{ _id: conversationId },
				{ $set: { users: newUsers, ...extraQuery } }
			)
				.then((updated) => {
					res.send({ success: true, msg: 'You are left from the group' });
				})
				.catch((err) => {
					res.send({ success: false, msg: 'Error while leaving you out' });
				});
		} else {
			res.send({ success: false, msg: 'Conversation not found' });
		}
	} catch (err) {
		res.send({ success: false, msg: 'Error while processing request' });
	}
};

export const editGroupDetailsByKeyValue = (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { key, value, id } = req.body;

	if (!key || !value || !id) {
		res.send({ success: false, msg: 'Please send proper parameters!' });
		return;
	}

	if (key !== 'image' && key !== 'description' && key !== 'name') {
		res.send({
			success: false,
			msg: 'Key must be either image, description or name',
		});
	}

	const updations: any = {};
	updations[key] = value;

	ConversationModel.updateOne({ _id: id }, { $set: updations })
		.then((updated) => res.send({ success: true, msg: 'Updated successfully!' }))
		.catch((err) => res.send({ success: true, msg: 'Unable to edit details' }));
};
