import Joi from 'joi';
import { Response } from 'express';
import { Request } from '../types/Request';
import EmailSubscription from '../models/EmailSubscription';

export const subscribe = (req: Request, res: Response) => {
	const { email, info, mobileNumber, collegeName } = req.body;
	const schema = Joi.object().keys({
		email: Joi.string().required().email(),
		collegeName: Joi.string().required(),
	});
	const { error } = schema.validate({ email, collegeName });
	if (error) {
		res
			.status(422)
			.send({ message: 'Invalid email', error: error.message, de: error.details });
	} else {
		EmailSubscription.countDocuments({ email }).exec((countError, count) => {
			if (countError) {
				res
					.status(500)
					.send({ message: 'Internal Server Error', error: countError });
			} else if (count > 0) {
				res.status(422).send({ message: 'You have already subscribed' });
			} else {
				const subscription = new EmailSubscription({
					email,
					mobileNumber,
					collegeName,
					trackingInfo: info,
				});
				subscription.save((saveError) => {
					if (saveError) {
						res.status(422).send({ message: 'You have already subscribed' });
					} else {
						res.send({ message: 'Subscribed successfully' });
					}
				});
			}
		});
	}
};
