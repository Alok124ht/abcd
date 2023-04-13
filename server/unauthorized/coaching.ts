import { Request } from '../types/Request';
import { v4 as uuidv4 } from 'uuid';
import { NextFunction, Response } from 'express';
import logger from '../../config/winston';
import APIError from '../helpers/APIError';
import config from '../../config/config';
import { getRandomString } from '../utils/string';
import { avatarS3 } from '../aws/s3';
import { sendEmail } from '../utils/mail';
import moment from 'moment';
import CoachingDemoRequestModel from '../models/CoachingDemoRequest';

const getFileExtension = (mime: string) => {
	const probableExtension = mime.split('application/')[1] || 'png';
	return probableExtension;
};

export async function getLogoUploadPolicy(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { ip } = req;
	logger.info(`getImageUploadPolicy called from ip: ${ip}`);
	const uuid = uuidv4();

	const { mime } = req.query;
	if (typeof mime !== 'string') {
		next(new APIError('mime not found', 422, true));
		return;
	}
	const fileExtension = getFileExtension(mime);
	const filePath = `coaching-registration/logo/${
		config.env
	}/${uuid}-${getRandomString(20)}.${fileExtension}`;
	return avatarS3.createPresignedPost(
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
}

export async function registerCoaching(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { coachingName, logoUrl, email, mobileNumber } = req.body;
	const coachingDemoRequest = new CoachingDemoRequestModel({
		coachingName,
		email,
		mobileNumber,
		userIp: req.ip,
		logoUrl,
	});
	coachingDemoRequest.save((saveError) => {
		if (saveError) {
			next(saveError);
		} else {
			res.send({ message: 'We have received your request' });
			const subject = `New coaching detail received`;
			const now = moment().format('DD-MM-YYYY hh:mmA');
			const body = `Coaching Name: ${coachingName}\nLogo: ${
				logoUrl || 'Not Uploaded'
			}\nEmail: ${email}\nMobile Number: +91-${mobileNumber}\nReceived At: ${now}\n`;

			sendEmail(
				{
					subject,
					from: 'help@prepseed.com',
					to: ['neel@prepseed.com'],
					body,
					bodyType: 'text',
				},
				() => {}
			);
		}
	});
}
