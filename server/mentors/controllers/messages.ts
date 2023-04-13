import { Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { Request } from '../../types/Request';
import MessageModel, { MessageDocument } from '../../models/Mentor/Message';
import AttachmentModel from '../../models/Mentor/Attachment';
import GroupModel, { GroupDocument } from '../../models/Mentor/Group';
import { parseMongooseErrors } from '../utils';
import moment from 'moment';

export const sendMessageToGroup = (
	req: Request,
	res: Response & {
		locals: {
			group: GroupDocument;
		};
	}
) => {
	const { id: userId } = req.payload;
	const { groupId } = req.params;
	const { data } = req.body;
	const { group } = res.locals;
	const message = new MessageModel({
		group: groupId,
		createdBy: userId,
		data,
	});

	message.save((err) => {
		if (err) {
			res.status(422).send({
				message: 'Invalid data',
				errors: parseMongooseErrors(err),
			});
		} else {
			if (data.type === 'attachment') {
				AttachmentModel.findById(data.attachment, (error, attachment) => {
					group.members.forEach((member) => {
						attachment.permissions.users.push({
							user: member,
							permission: 'comment',
						});
						attachment.groups.push(groupId);
					});
					attachment.save();
				});
			}
			res.send(message);
		}
	});
};

export const getGroupsOfUser = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	const sortOrder = 1;
	GroupModel.find({ members: Types.ObjectId(userId) })
		.populate({
			path: 'members',
			select: 'role name dp thumbnail lastConversationReadTimestamp',
		})
		.populate({
			path: 'lastMessage',
			populate: {
				path: 'data.attachment',
				populate: {
					path: 'thumbnail',
				},
			},
		})
		.sort({ 'lastMessage.createdAt': sortOrder })
		.exec()
		.then((groups) => {
			// TODO: calculate total groups separately if .limit is set in query
			res.send({ items: groups, totalGroups: groups.length });
		})
		.catch((error) => {
			res.status(500).send('Some error occurred');
			throw error;
		});
};

export const getMessagesOfGroup = (req: Request, res: Response) => {
	const { groupId } = req.params;
	const { limit: limitRaw, after, before, excludeGroup } = req.query;
	const filters: FilterQuery<MessageDocument> = { group: groupId };
	if (after && typeof after === 'string') {
		filters.createdAt = { $gt: new Date(parseInt(after, 10)) };
	}
	if (before && typeof before === 'string') {
		filters.createdAt = { $lt: new Date(parseInt(before, 10)) };
	}
	const executionDate = Date.now();
	let limit = typeof limitRaw === 'string' ? parseInt(limitRaw, 10) : 20;
	if (Number.isNaN(limit)) {
		limit = 20;
	}
	MessageModel.find(filters)
		.select('data user createdAt createdBy')
		.sort({ createdAt: 'desc' })
		.populate('data.attachment')
		.populate({
			path: 'data.attachment',
			populate: {
				path: 'thumbnail',
			},
		})
		.limit(limit)
		.exec()
		.then(async (messages) => {
			let group;
			if (!excludeGroup) {
				group = await GroupModel.findById(groupId)
					.populate({
						path: 'members',
						select: 'role name dp thumbnail',
					})
					.exec();
			}
			res.send({ items: messages, queryExecutedAt: executionDate, group });
		})
		.catch((error) => {
			res.status(500).send({
				error: 'Internal Server Error',
				desc: error.message,
			});
			throw error;
		});
};

export const markConversationAsRead = (req: Request, res: Response) => {
	const { groupId } = req.params;
	const { timestamp } = req.body;
	const { id: userId } = req.payload;
	GroupModel.findById(groupId).exec((err, group) => {
		if (err) {
			res.status(500).send({ message: 'Error occurred' });
		} else {
			group.set(`lastConversationReadTimestamp.${userId}`, new Date(timestamp));
			group.save();
			res.send({ group: group.toObject() });
		}
	});
};

export const getGroupsHavingUpdates = (req: Request, res: Response) => {
	const { id: userId } = req.payload;
	GroupModel.find({ members: Types.ObjectId(userId) })
		.select('lastMessage lastConversationReadTimestamp')
		.populate('lastMessage', 'createdAt')
		.exec((error, docs) => {
			if (error || !docs) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.send({
					count: docs.filter((group) => {
						try {
							const lastMessage = (group.lastMessage as unknown) as MessageDocument;
							const lastMessageTimestamp = new Date(lastMessage.createdAt);
							const readTimestamp = group.lastConversationReadTimestamp[userId]
								? new Date(group.lastConversationReadTimestamp[userId])
								: moment(lastMessageTimestamp).subtract(1000, 'milliseconds').toDate();
							return readTimestamp < lastMessageTimestamp;
						} catch (e) {
							return false;
						}
					}).length,
				});
			}
		});
};
