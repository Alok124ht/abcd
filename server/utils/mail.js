const nodemailer = require('nodemailer');
const AWS = require('aws-sdk');
const { ENVIRONMENT } = require('../../config/ENVIRONMENT');
const config = require('../../config/config');

const supportMailSMTPTransport = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: 'help@prepseed.com',
		pass: '?fH_XyNx#W$3t!E=',
	},
});

const ses = new AWS.SESV2({
	region: process.env.AWS_REGION,
	accessKeyId: process.env.SUPPORT_EMAIL_AWS_ACCESS_KEY_ID,
	secretAccessKey: process.env.SUPPORT_EMAIL_AWS_SECRET_ACCESS_KEY,
});

const sendEmail = (
	{
		subject,
		to,
		from = `${
			config.env === ENVIRONMENT.DEV ? 'Dev Prepseed' : 'Prepseed'
		}<noreply@prepseed.com>`,
		body,
		bodyType,
	},
	callback
) => {
	const isHtml =
		bodyType === 'html' || bodyType === 'Html' || bodyType === 'HTML';
	// TODO: param validation
	const params = {
		Content: {
			Simple: {
				Body: {
					[isHtml ? 'Html' : 'Text']: {
						Data: body,
						Charset: 'UTF-8',
					},
				},
				Subject: {
					Data: subject,
					Charset: 'UTF-8',
				},
			},
		},
		Destination: {
			ToAddresses: to,
		},
		FromEmailAddress: from,
	};
	ses.sendEmail(params, callback);
};

module.exports = {
	supportMailSMTPTransport,
	ses,
	sendEmail,
};
