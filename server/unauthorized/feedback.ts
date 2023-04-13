import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
const logger = require('../../config/winston').default;
import config from '../../config/config';
import Joi from 'joi';
import CourseFeedback from '../models/CourseFeedback';
import User from '../user/user.model';
import { getStrippedEmail } from '../utils/user/email';
import APIError from '../helpers/APIError';
import { Request } from '../types/Request';
import { NextFunction, Response } from 'express';

const s3 = new AWS.S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.AVATAR_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AVATAR_S3_SECRET_ACCESS_KEY,
});

const feedbackBaseSchema = Joi.object({
	email: Joi.string().required().email(),
	name: Joi.string().required().min(3),
	collegeName: Joi.string().required().min(3, 'utf8'),
	profilePictureUrl: Joi.string()
		.required()
		.uri({ scheme: ['https'] }),
	experience: Joi.string().required(),
	recommendationLevel: Joi.number().required().integer().min(1).max(10),
	type: Joi.string().valid('open'),
}).unknown(true);

const courseFeedbackScheme = feedbackBaseSchema
	.keys({
		courseRelevancy: Joi.number().required().integer().min(1).max(5),
		likedMost: Joi.string().required(),
		type: Joi.string().valid('course'),
	})
	.unknown(true);

const sessionFeedbackScheme = feedbackBaseSchema.keys({
	sessionRelevancy: Joi.number().required().integer().min(-1).max(5),
	likedMost: Joi.string().required(),
	type: Joi.string().valid('session'),
});

interface SchemeByType {
	[s: string]: Joi.ObjectSchema<any>;
}
const schemeByType: SchemeByType = {
	open: feedbackBaseSchema,
	course: courseFeedbackScheme,
	session: sessionFeedbackScheme,
};

const getFilename = () => {
	function makeid(length: number) {
		let result = '';
		const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
		const charactersLength = characters.length;
		for (let i = 0; i < length; i += 1) {
			if (i % 5 === 4 && i !== length - 1) {
				result += '-';
			} else {
				result += characters.charAt(Math.floor(Math.random() * charactersLength));
			}
		}
		return result;
	}
	return makeid(20);
};
const getFileExtension = (mime: string) => {
	const probableExtension = mime.split('image/')[1] || 'jpg';
	if (probableExtension === 'jpeg') {
		return 'jpg';
	}
	return probableExtension;
};

export const getImageUploadPolicy = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { ip } = req;
	logger.info(`getImageUploadPolicy called from ip: ${ip}`);
	const uuid = uuidv4();

	const { mime } = req.query;
	if (typeof mime !== 'string') {
		next(new APIError('mime not found', 422, true));
		return;
	}
	const fileExtension = getFileExtension(mime);
	const filePath = `course-feedback/${
		config.env
	}/${uuid}-${getFilename()}.${fileExtension}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AVATAR_S3_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: Object.assign({
				acl: 'public-read',
				key: filePath,
				'Content-Type': mime,
				'Cache-Control': 'max-age=32000000',
				mime,
			}),
		},
		(error, data) => {
			if (error) {
				res.status(422).send({ message: 'Unable to create policy', error });
			} else {
				res.send({ data, filePath });
			}
		}
	);
};

export function submit(req: Request, res: Response, next: NextFunction) {
	const { type = 'course' } = req.body;
	if (!['course', 'session', 'open'].includes(type)) {
		next(new APIError('Feedback validation failed', 422, true));
		return;
	}
	const selectedValidationSchema = schemeByType[type] || feedbackBaseSchema;
	const { error } = selectedValidationSchema.validate(req.body);
	const submittedBy = req.payload ? req.payload.id : null;
	if (error) {
		res.status(422).send({
			message: error.message,
			details: error.details,
		});
	} else {
		const courseFeedback = new CourseFeedback(req.body);
		if (submittedBy) {
			courseFeedback.set('submittedBy', submittedBy);
		}
		courseFeedback.set('userIp', req.ip);

		User.findOne({
			emailIdentifier: getStrippedEmail(req.body.email),
		})
			.select('_id')
			.exec((e, user) => {
				if (!e && user) {
					courseFeedback.user = user._id;
				}
				courseFeedback.save((saveError?: Error) => {
					if (saveError) {
						console.log(saveError);
						next(
							new APIError(
								'Could not submit your feedback. Please try again',
								422,
								true
							)
						);
						logger.error('Unable to submit feedback');
					} else {
						res.send({
							message: 'Thank you for your valuable feedback.',
							response: courseFeedback,
						});
					}
				});
			});
	}
}
