import { Request } from '../types/Request';

export const getUserAgentFromRequest = (req: Request) => {
	try {
		return req.headers['user-agent'];
	} catch (e) {
		return '';
	}
};
