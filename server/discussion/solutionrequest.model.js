const Promise = require('bluebird');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');
const nodemailer = require('nodemailer');

const SolutionrequestSchema = new mongoose.Schema(
	{
		question: {
			type: ObjectId,
			ref: 'Question',
		},
		users: [
			{
				user: {
					type: ObjectId,
					ref: 'User',
				},
			},
		],
		managed: {
			type: Boolean,
			default: false,
		},
		lastSent: {
			type: Date,
			default: Date.now,
		},
		responses: [
			{
				user: {
					type: ObjectId,
					ref: 'User',
				},
				solution: {
					type: Object,
				},
				accepted: {
					type: Boolean,
					default: false,
				},
			},
		],
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

SolutionrequestSchema.post('save', (doc) => {
	// if (
	// 	process.env.NODE_ENV === 'development' ||
	// 	process.env.NODE_ENV === 'staging'
	// ) {
	const smtpTransport = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'support@prepleaf.com',
			pass: 'bing@prepleafX',
		},
	});
	const mailOptions = {
		to: 'hitesh@prepleaf.com',
		from: 'support@prepleaf.com',
		subject: 'Solution Request (Important)',
		text:
			'Dear Admin\n\n' +
			'Please add solution for the following question \n' +
			`QuestionId: ${doc.question}` +
			'\n' +
			`RequestId: ${doc._id}` +
			'\n' +
			'Regards\nPrepleaf Content Manager',
	};
	smtpTransport.sendMail(mailOptions, function(err) {
		//res.json({success: true})
	});
	// }
});

SolutionrequestSchema.statics = {};

module.exports = mongoose.model('Solutionrequest', SolutionrequestSchema);
