import { Response, NextFunction } from 'express';
import { Request } from '../../types/Request';
import APIError from '../../helpers/APIError';
import ClientModel from '../client.model';

/**
 * Update information about client
 */
export async function updateInformation(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { clientId, jwtSecret, logo } = req.body;
	try {
		const client = await ClientModel.findById(clientId);
		if (!client) {
			next(new APIError('Client not found', 422, true));
		} else {
			if (typeof jwtSecret !== 'undefined') {
				client.jwtSecret = jwtSecret;
			}
			client.logo = logo;
			await client.save();
			res.send(client);
		}
	} catch (e) {
		next(e);
	}
}
