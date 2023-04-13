import { NextFunction, Response } from 'express';
import { Request } from '../../types/Request';
import Merchant from '../../models/Merchant';
import APIError from '../../helpers/APIError';

export const createMerchant = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { apiKeyId, apiKeySecret, name, razorpayMerchantId } = req.body;
	const merchant = new Merchant({
		apiKeyId,
		apiKeySecret,
		name,
		razorpayMerchantId,
	});
	try {
		await merchant.save();
		res.send(merchant);
	} catch (e) {
		next(e);
	}
};

export const updateMerchant = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { apiKeyId, apiKeySecret, name, razorpayMerchantId, _id } = req.body;
	try {
		const merchant = await Merchant.findById(_id);
		if (!merchant) {
			next(new APIError('Merchant not found', 422, true));
		} else {
			merchant.apiKeyId = apiKeyId;
			merchant.apiKeySecret = apiKeySecret;
			merchant.name = name;
			merchant.razorpayMerchantId = razorpayMerchantId;
			await merchant.save();
			res.send({ merchant });
		}
	} catch (e) {
		next(e);
	}
};

export const markMerchantDefault = async (
	req: Request | { body: { merchantId: string } },
	res: Response,
	next: NextFunction
) => {
	const { merchantId } = req.body;
	const previousDefaultMerchant = await Merchant.findOne({
		isDefault: true,
	});
	const currentDefaultMerchant = await Merchant.findOne({
		_id: merchantId,
	});
	if (previousDefaultMerchant) {
		if (previousDefaultMerchant._id.equals(merchantId)) {
			next(new APIError('This merchant is already the default merchant'));
		} else {
			if (!currentDefaultMerchant) {
				next(new APIError('Merchant not found.', 422, true));
			} else {
				previousDefaultMerchant.isDefault = false;
				currentDefaultMerchant.isDefault = true;
				try {
					await previousDefaultMerchant.save();
					await currentDefaultMerchant.save();
					res.send({
						message: `${currentDefaultMerchant.name} set as default merchant`,
					});
				} catch (e) {
					next(new APIError(e.message, 500, true));
				}
			}
		}
	} else {
		currentDefaultMerchant.isDefault = true;
		await currentDefaultMerchant.save();
		res.send({
			message: `${currentDefaultMerchant.name} set as default merchant`,
		});
	}
};

export const listMerchants = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const merchants = await Merchant.find().sort({ createdAt: -1 });
		res.send({ items: merchants });
	} catch (e) {
		next(e);
	}
};
