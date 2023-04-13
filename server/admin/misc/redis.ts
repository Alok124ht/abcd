import { Response, NextFunction } from 'express';
import { Request } from '../../types/Request';
import cacheManager from '../../cache/cache-manager';
import APIError from '../../helpers/APIError';

const cache = cacheManager({});

export async function getItemFromRedis(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { prefix, key } = req.query;
	if (typeof prefix !== 'string' || typeof key !== 'string') {
		next(new APIError('Prefix and key both are required', 422, true));
	}
	try {
		const item = await cache.get(`${prefix}-${key}`);
		res.send({ item });
	} catch (e) {
		next(new APIError(e.message, 500, true));
	}
}

export async function clearCache(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { prefix, key } = req.query;
	if (typeof prefix !== 'string' || typeof key !== 'string') {
		next(new APIError('Prefix and key both are required', 422, true));
	}

	cache.del(`${prefix}-${key}`, (error: Error, count?: any) => {
		if (error) {
			next(new APIError(error.message, 500, true));
		} else {
			res.send({ count });
		}
	});
}
