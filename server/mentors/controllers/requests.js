const MentorRequest = require('../../models/Mentor/Request');
const MentorshipType = require('../../models/Mentor/Type').default;
const Group = require('../../models/Mentor/Group').default;
const User = require('../../user/user.model').default;
const Message = require('../../models/Mentor/Message').default;
const Notification = require('../../models/Notification');
const {
	parseMongooseErrors,
	createMessagesFromQuestionAnswers,
	createEmailOptionsForMentorAssignment,
} = require('../utils');
const { supportMailSMTPTransport } = require('../../utils/mail');
const { refundOrder } = require('../../payments/utils/order');

const requestMentor = (req, res) => {
	const { id: userId } = req.payload;
	const { type: typeId, questionAnswers } = req.body;

	const timestamp = Date.now();
	MentorshipType.findById(typeId, (typeError, type) => {
		if (typeError) {
			res.status(422).send({ message: 'Invalid type selected.' });
		} else {
			const mRequest = new MentorRequest({
				user: userId,
				type,
				questionAnswers,
				lifeCycle: [
					{
						state: 'created',
						createdAt: timestamp,
					},
				],
				state: 'created',
			});
			mRequest.save((error, savedRequest) => {
				if (error) {
					res.status(500).send({
						message: 'Error occurred while saving request.',
					});
				} else {
					res.send({ request: savedRequest });
				}
			});
		}
	});
};

const cancelMentorRequest = (req, res) => {
	const { id: userId } = req.payload;
	const { id } = req.body;
	if (!id) {
		res.status(422).send({ message: 'Invalid request id' });
		return;
	}
	MentorRequest.findById(id)
		.populate('order')
		.populate('user')
		.exec((err, request) => {
			if (err) {
				res.status(500).send({
					message: 'Some error occurred while searching for mentor request',
				});
			} else if (!request) {
				res.status(422).send({ message: 'Invalid request id.' });
			} else if (!request.isCancelable) {
				res.status(403).send({
					message: 'Request can only be cancelled before a mentor is assigned.',
				});
			} else {
				const promises = [];
				if (request.state !== 'created') {
					promises.push(
						refundOrder({
							order: request.order,
							user: request.user,
							amount: request.order.amount,
							notes: [
								`${
									request.user._id.equals(userId)
										? 'Cancelled by user.'
										: 'Cancelled by admin.'
								}`,
							],
						})
					);
				}
				Promise.all(promises)
					.then(() => {
						request.set('state', 'cancelled');
						request.lifeCycle.push({
							state: request.state,
							createdAt: Date.now(),
						});
						request.save();
						res.send({ message: 'Request cancelled', request });
					})
					.catch((error) => {
						res.status(403).send({ message: error.message });
					});
			}
		});
};

const getRequest = (req, res) => {
	const { id } = req.query;
	MentorRequest.findById(id)
		.populate('type', 'basePrice currency identifier label available')
		.populate('mentor', 'name')
		.populate('order')
		.populate('questionAnswers.value.answer.attachment', 'url thumbnail name')
		.exec((error, request) => {
			if (error) {
				console.error(error);
				res.status(500).send({
					message: 'Internal server error occurred while searching for request',
				});
			} else if (!request) {
				res.status(422).send({
					message: "Either you don't own the Request or it doesn't exist",
				});
			} else {
				res.send(request);
			}
		});
};

const getRequestsForAdmin = (req, res) => {
	const query = {};
	const { state, sortBy = 'createdAt', sortOrder = '1' } = req.query;
	if (state) {
		query.state = state;
	}
	MentorRequest.find(query)
		.populate([
			{ path: 'user', select: 'name dp mobileNumber email' },
			{ path: 'mentor', select: 'name dp email' },
			{ path: 'type' },
			{
				path: 'order',
				populate: {
					path: 'coupon',
				},
				select: 'amount xpUsed xpDiscount couponDiscount coupon couponModel',
			},
			{
				path: 'questionAnswers.value.answer.attachment',
				select: 'url thumbnail name',
			},
		])
		.sort({ [sortBy]: sortOrder })
		.exec()
		.then((requests) => {
			res.send({ list: requests, total: requests.length });
		})
		.catch((error) => {
			console.error(error);
			res.status(422).send({ message: 'Some error occurred' });
		});
};

const getMyRequests = (req, res) => {
	const { id: userId } = req.payload;
	const { tab, sortOrder = 'desc', sortBy = 'updatedAt' } = req.query;
	const filters = { user: userId };
	if (tab) {
		if (tab === 'closed') {
			filters.state = { $in: ['cancelled', 'closed'] };
		} else if (tab === 'open') {
			filters.state = { $in: ['created', 'pending', 'active'] };
		}
	}
	MentorRequest.find(filters)
		.populate('user', 'name')
		.populate('mentor', 'name')
		.populate('type')
		.limit(20)
		.sort({ [sortBy]: sortOrder })
		.exec()
		.then((requests) => {
			res.send({ list: requests, total: requests.length });
		})
		.catch(() => {
			res.status(422).send({ message: 'Some error occurred' });
		});
};

const assignMentorForRequest = (req, res) => {
	const { id: requestId, mentor: mentorId } = req.body;
	User.findById(mentorId)
		.select('name email')
		.exec((mentorSearchError, mentor) => {
			if (mentorSearchError) {
				res.status(500).send({
					message: 'Internal Server Error occurred while searching for mentor',
				});
			} else {
				MentorRequest.findOne({ _id: requestId })
					.populate('type')
					.populate('user', 'email name username')
					.exec()
					.then((mRequest) => {
						mRequest.set('mentor', mentorId);
						mRequest.set('state', 'active');
						const group = new Group({
							members: [mentorId, mRequest.user],
						});
						group.save();
						mRequest.set('conversationGroup', group._id);
						mRequest.lifeCycle.push({
							state: 'active',
							createdAt: Date.now(),
						});
						mRequest.save((err) => {
							if (err) {
								res.status(422).send({
									message: 'Invalid parameters',
									errors: parseMongooseErrors(err),
								});
							} else {
								const messages = createMessagesFromQuestionAnswers({
									questionAnswers: mRequest.questionAnswers,
									groupId: group._id,
									mentorId,
									userId: mRequest.user._id,
								});
								createEmailOptionsForMentorAssignment({
									request: mRequest,
									group,
									user: mRequest.user,
									mentor,
								}).then((mailOptions) => {
									supportMailSMTPTransport.sendMail(mailOptions, (error) => {
										if (error) {
											/* eslint-disable no-console
											 */
											console.error(error);
											console.error(`failed to send mail to ${mailOptions.to}`);
										}
									});
								});
								Message.insertMany(messages);
								res.send({
									request: mRequest.toObject(),
								});
								// const category = getCategoryById(mRequest.category);
								const notificationContent = `Your request for <b>${mRequest.type.label}</b> has been accepted and <b>${mentor.name}</b> has been assigned as your mentor.`;
								const notification = new Notification({
									user: mRequest.user._id,
									content: {
										type: 'html',
										data: notificationContent,
									},
									action: {
										type: 'open-request-detail',
										event: 'click',
										data: { id: mRequest._id },
									},
									actions: [
										{
											type: 'open-chat',
											event: 'click',
											data: { id: group._id },
											text: 'Start Chat',
										},
									],
									product: 'mentorship',
								});
								notification.save();
							}
						});
					});
			}
		});
};

module.exports = {
	cancelMentorRequest,
	requestMentor,
	getRequestsForAdmin,
	getRequest,
	getMyRequests,
	assignMentorForRequest,
};
