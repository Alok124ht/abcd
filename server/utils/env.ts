import config from '../../config/config';
import { Request } from '../types/Request';
const defaultCookieHostName = process.env.API_HOSTNAME || 'prepseed.com';
const baseApi = `${process.env.API_BASE_HOST}${process.env.API_BASE_PATH}`;

export const getCookieHostName = (req: Request) => {
	const { hostname } = req;
	const cookieHostName =
		config.env === 'development' ? req.hostname : defaultCookieHostName;
	if (hostname === 'api.vyasedification.com') {
		return cookieHostName.replace('prepseed', 'vyasedification');
	}
	return cookieHostName;
};

export const getBaseApi = (req: Request) => {
	const { hostname } = req;
	if (hostname === 'api.vyasedification.com') {
		return baseApi.replace('prepseed', 'vyasedification');
	}
	return baseApi;
};
