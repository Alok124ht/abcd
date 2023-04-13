const Email = require('email-templates');
const Message = require('../models/Mentor/Message').default;
const Attachment = require('../models/Mentor/Attachment');

const parseMongooseErrors = (error) => {
	try {
		const e = {};
		Object.keys(error.errors).forEach((key) => {
			e[key] = error.errors[key].message;
		});
		return e;
	} catch (er) {
		return {};
	}
};

const createMessagesFromQuestionAnswers = ({
	questionAnswers,
	groupId,
	mentorId,
	userId,
}) => {
	const messages = [];
	const attachmentIds = [];
	let time = Date.now();
	questionAnswers.forEach(({ value: { question, answer } }) => {
		time += 1000;
		const mentorMessage = new Message({
			createdBy: mentorId,
			group: groupId,
			data: {
				type: 'text',
				text: question.label,
			},
			createdAt: time,
		});
		messages.push(mentorMessage);

		time += 1000;
		const userMessage = new Message({
			createdBy: userId,
			group: groupId,
			data: answer,
			createdAt: time,
		});
		try {
			if (answer.attachment) {
				attachmentIds.push(answer.attachment);
			}
		} catch (e) {
			/* eslint-disable
			 */
			console.log(
				'Unexpected error in createMessagesFromQuestionAnswers while pushing answer.attachment to attachmentIds'
			);
			console.error(e);
		}
		messages.push(userMessage);
	});

	if (attachmentIds) {
		try {
			Attachment.updateMany(
				{ _id: { $in: attachmentIds } },
				{
					$push: {
						groups: groupId,
						'permissions.users': {
							$each: [
								{
									user: mentorId,
									permission: 'comment',
								},
							],
						},
					},
				},
				(error, res) => {}
			);
		} catch (e) {
			/* eslint-disable
			 */
			console.error(e);
			console.log(
				'failed command updateMany in createMessagesFromQuestionAnswers'
			);
		}
	}
	return messages;
};

const createEmailOptionsForMentorAssignment = ({
	group,
	request,
	user,
	mentor,
}) => {
	const promise = new Promise((resolve, reject) => {
		const options = {};
		options.to = user.email;
		options.from = 'Prepseed <noreply@prepseed.com>';
		options.subject = `Mentor assigned for ${request.type.label}`;

		const email = new Email();
		let name = '';
		try {
			name = user.name.split(' ')[0];
		} catch (e) {
			name = user.name;
		} finally {
			if (!name) {
				try {
					name = user.email.split('@')[0];
				} catch (e) {
					name = 'user';
				}
			}
		}
		console.log({ name, user: { name: user.name } });
		email
			.render('mentorship/assign/html', {
				name,
				mentorName: mentor.name,
				label: request.type.label,
			})
			.then((html) => {
				options.html = html;
				resolve(options);
			});
		return;
	});
	return promise;
};

module.exports = {
	parseMongooseErrors,
	createMessagesFromQuestionAnswers,
	createEmailOptionsForMentorAssignment,
};
