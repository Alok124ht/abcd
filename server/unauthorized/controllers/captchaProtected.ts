import axios from 'axios';
import qs from 'qs';
import APIError from '../../helpers/APIError';

export async function getTeamEmails(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const emailsByKey = {
		neel: 'neel@prepseed.com',
		vivek: 'vivek@prepseed.com',
	};
	try {
		const { captchaToken } = req.body;
		const response = (
			await axios.post(
				'https://www.google.com/recaptcha/api/siteverify',
				qs.stringify({
					secret: '6LdvOIMcAAAAAOB7vyG_5vsadL60D1Faxsi_sZgA',
					response: captchaToken,
				})
			)
		).data;
		const { score, success } = response;
		if (!success) {
			next(new APIError('We can not show this content to you'));
		} else if (score < 0.5) {
			next(new APIError('It looks like you are a robot'));
		} else {
			res.send({ emailsByKey, score });
		}
	} catch (e) {
		next(new APIError('We can not show this content to you'));
	}
}
