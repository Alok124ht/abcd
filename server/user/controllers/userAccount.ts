import { NextFunction, Response } from 'express';
import { Request } from '../../types/Request';
import User from '../user.model';
import { getByUserId } from '../../cache/UserAccount';
import TokenCache from '../../cache/Token';
import APIError from '../../helpers/APIError';
import config from '../../../config/config';
import { getCookieHostName } from '../../utils/env';
import { getTokenFromHeaders } from '../../utils/auth';
import { getUserAgentFromRequest } from '../../utils/request';

export async function getMyAccount(req: Request, res: Response) {
	const { id } = req.payload;
	const user = await User.findById(id);
	const account = await user.getAccount();
	res.send(account);
}

export async function switchUser(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { id } = req.payload;
	const { userId } = req.body;
	getByUserId(
		id,
		async (
			currentUserAccountSearchError: Error,
			currentAccount: { users: { _id: string }[] }
		) => {
			if (currentUserAccountSearchError) {
				next(new APIError('Failed while searching user account'));
			} else if (!currentAccount) {
				next(new APIError('User account does not exist'));
			} else {
				if (!currentAccount.users.some((user) => user._id.toString() === userId)) {
					console.log(currentAccount.users);
					next(new APIError('You can not switch to this user', 422, true));
				} else {
					TokenCache.blacklist(
						getTokenFromHeaders(req),
						id,
						getUserAgentFromRequest(req),
						{ r: 'AUS', logoutIp: req.ip }
					);
					const user = await User.findById(userId);
					const token = await user.generateJWT(req);
					res.cookie('auth', token, {
						...config.authCookie,
						domain: getCookieHostName(req),
					});
					res.send({ message: 'User switched' });
				}
			}
		}
	);
}
