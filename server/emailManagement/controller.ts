import { filter, includes, map, size, some } from 'lodash';
import { Request } from '../types/Request';
import { NextFunction, Response } from 'express';
import { sendEmail } from '../utils/mail';
import EmailBounceModel from '../models/EmailBounce';
import { getStrippedEmail } from '../utils/user/email';
import APIError from '../helpers/APIError';
import EmailLog from './models/EmailLog';

export const send = (
	req: Request & { body: { recipients: string[] } },
	res: Response,
	next: NextFunction
) => {
	const {
		recipients,
		body,
		bodyType,
		subject,
		from,
	}: {
		recipients: string[];
		body: string;
		bodyType: string;
		subject: string;
		from?: string;
	} = req.body;
	const { id: userId } = req.payload;
	EmailBounceModel.find({
		ei: {
			$in: map(recipients, (emailAddress) =>
				getStrippedEmail(emailAddress, { removeDots: false })
			),
		},
	}).exec((searchError, emailBounces) => {
		if (searchError) {
			next(new APIError('Failed', 500));
		} else {
			const filteredRecipients = filter(
				recipients,
				(r) =>
					!some(
						emailBounces,
						(eb) => eb.ei === getStrippedEmail(r, { removeDots: false })
					) || includes(r, '@simulator.amazonses.com')
			);
			if (size(filteredRecipients) === 0) {
				res.status(422).send({
					message:
						'Can not send to any of the Recipients because they are in bounced list',
				});
			} else {
				const emailLog = new EmailLog({
					subject,
					body,
					to: filteredRecipients,
					bodyType,
					createdBy: userId,
				});
				const emailConfig: {
					subject: string;
					to: string[];
					body: string;
					bodyType: string;
					from?: string;
				} = {
					subject,
					to: filteredRecipients,
					body,
					bodyType,
				};
				if (from) {
					emailConfig.from = from;
				}
				sendEmail(emailConfig, (error: Error) => {
					if (error) {
						emailLog.set('status', 'ftsts');
						res.status(422).send({ message: 'Failed', error: error.message });
					} else {
						emailLog.set('status', 'sts');
						res.send({});
					}
					emailLog.save(() => {});
				});
			}
		}
	});
};
