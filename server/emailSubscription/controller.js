const moment = require('moment');
const { forEach, map, size } = require('lodash');
const { convertArrayToCSV } = require('convert-array-to-csv');
const config = require('../../config/config');
const EmailSubscription = require('../models/EmailSubscription').default;
const { getStrippedEmail } = require('../utils/user/email');
const EmailBounceModel = require('../models/EmailBounce').default;
const { sendEmail } = require('../utils/mail');

const convertToCSV = (items) => {
	const dateFormat = 'DD-MM-YYYY hh:mm A';
	const header = ['Email', `Subscribed At (${dateFormat})`, 'Origin', 'Path'];
	const data = map(items, (item) => [
		item.email,
		moment(item.createdAt).format(dateFormat),
		item.trackingInfo ? item.trackingInfo.origin : '',
		item.trackingInfo ? item.trackingInfo.pathname : '',
	]);
	return convertArrayToCSV(data, {
		header,
	});
};

const list = (req, res) => {
	EmailSubscription.find({}).exec((error, items) => {
		if (error) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else {
			const data = convertToCSV(items);
			res.attachment('subscribers.csv');
			res.type('text/csv');
			res.send(data);
		}
	});
};

const addEmailToBounceList = (req, res) => {
	if (req.query.token !== config.emailBounceNotificationToken) {
		res.status(422).send({ message: 'Invalid Token' });
		return;
	}
	try {
		const body = JSON.parse(req.body);
		if (body.notificationType === 'Bounce') {
			const bounceType = body.bounce.bounceType;
			if (bounceType === 'Permanent') {
				const emails = map(body.bounce.bouncedRecipients, (r) => r.emailAddress);
				forEach(emails, (email) => {
					const emailBounce = new EmailBounceModel({
						e: email,
						ei: getStrippedEmail(email),
						bt: bounceType,
					});
					emailBounce.save(() => {});
				});
			}
		} else if (body.notificationType === 'Complaint') {
			const complainedRecipients = body.complaint.complainedRecipients;
			if (size(complainedRecipients) === 1) {
				/**
				 * if mail was sent to more than one recipient then it is not certain that who complained
				 * Refer to this: https://docs.aws.amazon.com/ses/latest/DeveloperGuide/notification-contents.html#complained-recipients
				 */
				const email = complainedRecipients[0].emailAddress;
				EmailBounceModel.create({
					e: email,
					ei: getStrippedEmail(email),
					bt: 'Complaint',
				});
				sendEmail(
					{
						to: ['amit@prepleaf.com'],
						bodyType: 'Text',
						body: `Received a complain from ${email}`,
						subject: 'Email Complaint Received',
					},
					() => {}
				);
			}
		} else if (body.Type === 'SubscriptionConfirmation') {
			sendEmail(
				{
					to: ['amit@prepleaf.com'],
					bodyType: 'Text',
					body: req.body,
					subject: 'Confirmation Message recieved from AWS',
				},
				() => {}
			);
		}
	} catch (e) {
		console.error(e);
		console.log('some error occurred while adding/parsing email bounce');
	} finally {
		res.send({ message: 'Received' });
	}
};

const getBounceList = (req, res) => {
	EmailBounceModel.find().exec((searchError, emailBounces) => {
		if (searchError) {
			res.status(500).send({});
		} else {
			res.send({ emailBounces });
		}
	});
};

module.exports = { list, addEmailToBounceList, getBounceList };
