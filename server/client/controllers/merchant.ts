import { Request } from '../../types/Request';
import { Response, NextFunction } from 'express';
import Client from '../client.model';
import APIError from '../../helpers/APIError';
import Merchant from '../../models/Merchant';

export const associateMerchant = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { clientId, merchantId } = req.body;
	try {
		const client = await Client.findById(clientId);

		if (!client) {
			next(new APIError('Client not found', 404, true));
		} else {
			if (client.merchants.some((mId) => mId.equals(merchantId))) {
				next(
					new APIError('This merchant has already been associated with this client.')
				);
			} else {
				client.merchants.push(merchantId);
				client.save((saveError) => {
					if (saveError) {
						next(new APIError(saveError, 422));
					} else {
						res.send({ client });
					}
				});
			}
		}
	} catch (err) {
		next(new APIError(err, 500));
	}
};

export const getMerchants = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { id: userId, role } = req.payload;

	const populate = 'merchants';
	const select = 'merchants';
	if (role === 'super') {
		Merchant.find().exec((searchError, razorpayAccounts) => {
			if (searchError) {
				next(new APIError(searchError.message, 500));
			} else {
				res.send({ items: razorpayAccounts });
			}
		});
	} else {
		Client.findOne({ moderators: userId })
			.select(select)
			.populate(populate)
			.exec((searchError, client) => {
				if (searchError) {
					next(new APIError(searchError.message, 500));
				} else if (!client) {
					next(new APIError('Client not found', 404));
				} else {
					res.send({ items: client.merchants });
				}
			});
	}
};
