import { Response, NextFunction } from 'express';
import { some } from 'lodash';
import jwt from 'jsonwebtoken';
import { Request } from '../../types/Request';
import User from '../user.model';
import ClientModel from '../../client/client.model';
import APIError from '../../helpers/APIError';
import { Types } from 'mongoose';
import { getStrippedEmail } from '../../utils/user/email';
import config from '../../../config/config';
import { getCookieHostName } from '../../utils/env';
import { UserRole } from '../IUser';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';

export async function signInUsingClientJWT(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const token = req.query.token;
	if (typeof token !== 'string' || !token) {
		next(new APIError('Token not set', 422, true));
		return;
	}
	const decodedToken = jwt.decode(token);
	if (!decodedToken || typeof decodedToken === 'string') {
		next(new APIError('Invalid token', 422, true));
		return;
	}
	const clientId = decodedToken.cid;
	if (!Types.ObjectId.isValid(clientId)) {
		next(new APIError('Invalid client id', 422, true));
		return;
	}
	const client = await ClientModel.findById(clientId).select('jwtSecret phases');
	if (!client) {
		next(new APIError('Client not found', 422, true));
		return;
	}

	if (!client.jwtSecret) {
		next(
			new APIError(`Client JWT setup incomplete ${client.jwtSecret}`, 422, true)
		);
		return;
	}
	jwt.verify(
		token,
		client.jwtSecret,
		async (error: Error, verifiedDecodedToken: any) => {
			if (error) {
				next(new APIError('Could not verify token', 422, true));
			} else {
				const { email } = verifiedDecodedToken;
				// sign in now
				const user = await User.findOne({
					emailIdentifier: getStrippedEmail(email),
					role: UserRole.USER,
				}).select('role type subscriptions');
				if (!user) {
					next(new APIError('Invalid email', 422, true));
				} else {
					const userPhases = getActivePhasesFromSubscriptions(user.subscriptions);
					if (
						some(client.phases, (phase) => some(userPhases, (p) => phase.equals(p)))
					) {
						const userJwt = await user.generateJWT(req);
						res.cookie('auth', userJwt, {
							...config.authCookie,
							domain: getCookieHostName(req),
						});
						res.send({ token: userJwt });
					} else {
						console.log(client.phases, userPhases, user.subscriptions);
						next(new APIError('Access denieed', 422, true));
					}
					// verify that client has permission to log into this user's account
				}
			}
		}
	);
}
