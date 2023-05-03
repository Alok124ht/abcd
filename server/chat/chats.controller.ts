import { forEach, get, isArray, toNumber, toString } from 'lodash';
import UserModel from '../user/user.model';
import ConversationModel from './models/conversations.model';
import MessagesModel from './models/messages.model';
import { UserInConversation } from './types/conversations';
import PhaseMentorModel from '../phase/PhaseMentor';
import ClientModel from '../client/client.model';
import MessageMediaModel from './models/messagesmedia';
import PhaseModel from '../phase/phase.model';
import SubjectModel from '../models/Subject';
import multer, { diskStorage } from 'multer';
import * as path from 'path';
import multerS3 from 'multer-s3';
import AWS from 'aws-sdk';
import { Request } from 'express';
import { S3Client } from '@aws-sdk/client-s3';

// const multerStorage = diskStorage({
// 	destination: function (req,  file, cb) {
// 	  cb(
// 		null,
// 		'C:\\Users\\Meet Shah\\Downloads\\node-backend-production\\node-backend-production\\server\\chat\\mediafolder'
// 	  );
// 	},
// 	filename: function (req, file, cb) {
// 	  const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1e9);
// 	  let extens = file.mimetype.split('/')[1];
// 	  cb(null, file.fieldname + '_' + uniqueSuffix + '.' + extens);
// 	},
//   });
interface MulterFile extends Express.Multer.File {
	location?: string;
}
const s3 = new S3Client({
	region: process.env.AVATAR_S3_AWS_REGION,
	credentials: {
		accessKeyId: process.env.AVATAR_S3_ACCESS_KEY_ID,
		secretAccessKey: process.env.AVATAR_S3_SECRET_ACCESS_KEY,
	},
});

const upload = multer({
	storage: multerS3({
		s3: s3,
		bucket: process.env.AVATAR_S3_BUCKET,
		acl: 'public-read',
		contentType: multerS3.AUTO_CONTENT_TYPE,
		key: function (req, file, cb) {
			cb(null, Date.now().toString() + '-' + file.originalname);
		},
	}),

	// 	fileFilter: function(req, file, cb) {
	// 		const allowedMimes = [
	// 		  'jpeg',
	// 		  'jpg',
	// 		  'png',
	// 		  'gif',
	// 		  'mp4',
	// 		  'pdf',
	// 		  'mpeg'
	// 		];
	// 		if (allowedMimes.includes(file.mimetype)) {
	// 		  cb(null, true);
	// 		} else {
	// 		  cb(new Error('Invalid '));
	// 		}
	// 	  }
});

import { MulterError } from 'multer';

export const addTokenToUser = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { id: userId, fcmToken } = req.body;
		const userTokening = await UserModel.findById(userId);
		userTokening.fcmToken = fcmToken;
		await userTokening.save();
		res.json({ success: true, msg: 'Token added successfully' });
	} catch (error) {
		console.error(error);
		res.json({ success: false, msg: 'Token Integration Failed' });
	}
};

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

export const filteredConversation = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		console.log('********************** Called *****************************');
		const {
			std = [],
			levels = [],
			subject = [],
			queryPhase = [],
			batch = [],
		}: {
			std?: string[];
			levels?: string[];
			subject?: string[];
			queryPhase?: string[];
			batch?: string[];
		} = req.query;
		const time: string = req.query.time as string;

		if (
			queryPhase.length === 0 &&
			std.length === 0 &&
			levels.length === 0 &&
			subject.length === 0 &&
			batch.length === 0
		) {
			return res
				.status(400)
				.json({ msg: 'At least one query parameter is required' });
		}

		const filter: any = {};

		if (queryPhase.length > 0) {
			console.log(queryPhase);
			const phase = await PhaseModel.find({ name: { $in: queryPhase } });
			if (phase) {
				let phaseIds: string[] = [];
				phaseIds = phase.map((e) => e._id);
				console.log(phaseIds);
				filter.phases = { $in: phaseIds };
			} else {
				return res.json({ success: false, msg: 'No conversations to load' });
			}
		}

		if (std.length > 0) {
			console.log(std);
			filter.standard = { $in: std };
		}

		if (levels.length > 0) {
			const parsedLevels = levels.map((e) => toNumber(e));
			filter.level = { $in: parsedLevels };
		}

		if (subject.length > 0) {
			const subjectFetched = await SubjectModel.find({ name: { $in: subject } });
			if (subjectFetched) {
				let subjectIds: string[] = [];
				subjectIds = subjectFetched.map((e) => e._id);
				console.log(subjectIds);
				filter.subjects = { $in: subjectIds };
			} else {
				return res.json({ success: false, msg: 'No conversations to load' });
			}
		}

		if (batch.length > 0) {
			filter.batch = { $in: batch };
		}

		console.log(filter);
		const users = await UserModel.find(filter);
		const userIds = users.map((user: any) => user._id);

		const conversations = await ConversationModel.find({
			'users.user': { $in: userIds },
			isGroup: true,
		}).populate({ path: 'users.user', select: 'name username email mobile dp' });
		// console.log(conversations._id);
		if (time && (req.query.date || (req.query.fromDate && req.query.toDate))) {
			return res.json({
				success: false,
				msg: 'Time and date cannot be clubbed together',
			});
		}

		if (
			(req.query.fromDate && !req.query.toDate) ||
			(!req.query.fromDate && req.query.toDate)
		) {
			return res.json({
				success: false,
				msg: 'Both fromDate and toDate are required',
			});
		}

		if (req.query.fromDate && req.query.toDate && req.query.date) {
			return res.json({
				success: false,
				msg: 'All 3 fields cant be passed date,fromDate,toDate',
			});
		}

		if ((req.query.date || (req.query.fromDate && req.query.toDate)) && !time) {
			let queryDate: Date | null = null;
			let fromDate: Date | null = null;
			let toDate: Date | null = null;
			if (req.query.date) {
				queryDate = new Date(req.query.date as string);
			} else {
				fromDate = new Date(req.query.fromDate as string);
				toDate = new Date(req.query.toDate as string);
			}
			const filteredConvos: string[] = [];
			for (const conversation of conversations) {
				const messagesDate = await MessagesModel.find({
					conversation: conversation._id,
				});
				messagesDate.forEach((message: any) => {
					if (queryDate) {
						if (message.createdAt.toDateString() === queryDate.toDateString()) {
							filteredConvos.push(message.conversation);
						}
					} else {
						if (message.createdAt >= fromDate && message.createdAt <= toDate) {
							filteredConvos.push(message.conversation);
						}
					}
				});
			}
			if (filteredConvos.length !== 0) {
				const uniqueConversations = [...new Set(filteredConvos)];
				const conversations = await ConversationModel.find({
					_id: { $in: uniqueConversations },
					isGroup: true,
				}).populate({
					path: 'users.user',
					select: 'name username email mobile dp',
				});
				return res.json({ success: true, conversations });
			} else {
				return res.json({ success: false, msg: 'No conversations to load' });
			}
		}

		if (time && !(req.query.date || (req.query.fromDate && req.query.toDate))) {
			const maxHours = parseInt(time) * 24;
			const filteredConversations: any[] = [];
			for (const conversation of conversations) {
				const messages = await MessagesModel.find({
					conversation: conversation._id,
				}).sort({ createdAt: -1 });
				if (messages.length > 0) {
					const lastMessage = messages[0];
					const timeDiff = new Date().getTime() - lastMessage.createdAt.getTime();
					const hoursDiff = timeDiff / 1000 / 60 / 60;
					if (hoursDiff < maxHours) {
						filteredConversations.push(conversation);
					}
				}
			}
			if (filteredConversations.length !== 0) {
				console.log(filteredConversations);
				return res.json({ success: true, conversations: filteredConversations });
			} else {
				return res.json({ success: false, msg: 'No conversations to load' });
			}
		}

		if (conversations.length !== 0) {
			res.json({ success: true, conversations });
		} else {
			res.json({ success: false, msg: 'No conversations to load' });
		}
	} catch (error) {
		console.log(error);
	}
};

export const dateFilter = (req: ExpressRequest, res: ExpressResponse) => {
	try {
		let queryDate: Date | null = null;
		let fromDate: Date | null = null;
		let toDate: Date | null = null;

		if (req.query.date) {
			queryDate = new Date(req.query.date as string);
		} else {
			if (!req.query.fromDate || !req.query.toDate) {
				return res
					.status(400)
					.json({ msg: 'Both fromDate and toDate are required' });
			}
			fromDate = new Date(req.query.fromDate as string);
			toDate = new Date(req.query.toDate as string);
		}

		let conversationIds: string[] = [];
		ConversationModel.find({}, (err: any, conversations: any) => {
			if (err) throw err;

			conversations.forEach((conversation: any) => {
				conversationIds.push(conversation._id);
			});

			let filteredConversations: string[] = [];
			MessagesModel.find(
				{ conversation: { $in: conversationIds } },
				(err: any, messages: any) => {
					if (err) throw err;

					messages.forEach((message: any) => {
						if (queryDate) {
							if (message.createdAt.toDateString() === queryDate.toDateString()) {
								filteredConversations.push(message.conversation);
							}
						} else {
							if (message.createdAt >= fromDate && message.createdAt <= toDate) {
								filteredConversations.push(message.conversation);
							}
						}
					});

					if (filteredConversations.length !== 0) {
						const uniqueConversations = [...new Set(filteredConversations)];
						ConversationModel.find({
							_id: { $in: uniqueConversations },
							isGroup: true,
						})
							.populate({
								path: 'users.user',
								select: 'name username email mobile dp',
							})
							.exec((err, conversations) => {
								if (err) throw err;

								return res.json({ success: true, conversations });
							});
					} else {
						return res.json({ success: false, msg: 'No conversations to load' });
					}
				}
			);
		});
	} catch (error) {
		console.log(error);
	}
};

export const timeFilter = async (req: ExpressRequest, res: ExpressResponse) => {
	try {
		const time = parseInt(req.query.time as string);
		console.log('Time = ' + time);
		const conversations = await ConversationModel.find({ isGroup: true });
		const filteredConversations: any[] = [];

		for (const conversation of conversations) {
			const messages = await MessagesModel.find({
				conversation: conversation._id,
			}).sort({ createdAt: -1 });

			if (messages.length > 0) {
				const lastMessage = messages[0];
				console.log('Last Message' + lastMessage);
				const timeDiff: number =
					new Date().getTime() - lastMessage.createdAt.getTime();
				const hoursDiff: number = timeDiff / 1000 / 60 / 60;
				const maxHours: number = time * 24;

				if (hoursDiff < maxHours) {
					filteredConversations.push(conversation);
				}
			}
		}

		return res.json(filteredConversations);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ error: 'Server error' });
	}
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
		.populate({
			path: 'media',
			select: 'url mediaType',
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
	upload.array('filesname', 10)(req, res, async (err: any) => {
		if (err instanceof MulterError) {
			// Handle Multer errors
			return res.status(500).json({ error: err.message });
		} else if (err) {
			// Handle other errors
			return res.status(500).json({ error: err.message });
		}
		// console.log(req.files);
		const { id: conversation, text } = req.body;
		const { id: sender } = req.payload;
		if (!conversation) {
			return res.send({ success: false, msg: 'Converstaion Id Not Sent' });
		}
		// if (text === '' && !req.files) {
		//     return res.send({
		//         success: false,
		//         msg: 'At least One Parameter Text or File should be passed',
		//     });
		// }

		let newMessage = new MessagesModel({
			conversation,
			text,
			sender,
			readBy: [sender],
			mediaType: '',
		});

		if (req.files) {
			let mediaIds: any[] = [];
			for (let file of req.files as MulterFile[]) {
				const reqFilename = file.originalname;
				const reqFileExtention = file.mimetype.split('/')[1];
				const reqMimeType = file.mimetype.split('/')[0];
				const reqFileUrl = file.location;
				const newMediaMessage = new MessageMediaModel({
					url: reqFileUrl,
					mediaType: reqMimeType,
					message: newMessage._id,
				});
				console.log(newMediaMessage);

				const saved1 = await newMediaMessage.save();

				if (saved1) {
					mediaIds.push(saved1._id);
				}
			}
			newMessage.media = mediaIds;
		}
		// console.log(newMessage)

		newMessage.save(async (err: any, saved: any) => {
			if (saved) {
				const conversation = await ConversationModel.findById(
					saved.conversation
				).populate({ path: 'users.user', select: 'name username email mobile dp' });
				const temporaryDeletedFor: any[] = [];
				if (conversation.isGroup) {
					conversation.users.forEach((users: any) => {
						temporaryDeletedFor.push(users.user);
					});
				}
				ConversationModel.updateOne(
					{ _id: conversation._id },
					{ $pop: { temporaryDeletedFor } }
				);
				return res.send({ success: true, msg: 'Message sent!' });
			} else {
				return res.send({ success: false, msg: err + 'Failed to sent!' });
			}
		});
	});
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
