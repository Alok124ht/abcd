import { Request } from '../types/Request';
import { NextFunction, Response } from 'express';
import jwt from 'express-jwt';
import {
	isTokenRevoked as _isTokenRevoked,
	blacklistAll,
} from '../cache/Token';
import APIError from '../helpers/APIError';
import User from '../user/user.model';
import ClientModel from '../client/client.model';
import { getCookieHostName } from '../utils/env';
import { IUser, UserRole } from '../user/IUser';
import { isAtLeast } from '../utils/user/role';
import { default as getTokenFromHeaders } from '../utils/auth';

const userHasRole = (user: IUser, role: UserRole) =>
	isAtLeast(role, user.role) || role === 'super';

const getUser = (
	req: Request,
	res: Response,
	callback: (user: IUser) => void
) => {
	if (res.locals.user) {
		callback(res.locals.user);
	} else if (req.payload.id) {
		User.findById(req.payload.id, (error, user) => {
			if (error || !user) {
				callback(null);
			} else {
				callback(user);
			}
		});
	} else {
		callback(null);
	}
};

const createRoleValidator =
	(role: UserRole) => (req: Request, res: Response, next: NextFunction) => {
		getUser(req, res, (user: IUser) => {
			if (user && userHasRole(user, role)) {
				next();
			} else {
				res.status(403).send({
					message: 'You do not have required permission',
				});
			}
		});
	};

const isModerator = createRoleValidator(UserRole.MODERATOR);

const isAdmin = createRoleValidator(UserRole.ADMIN);

const isSuper = createRoleValidator(UserRole.SUPER);
const isAtLeastMentor = createRoleValidator(UserRole.MENTOR);

const isTokenRevoked = (
	req: Request,
	payload: any,
	done: (err: any, revoked?: boolean) => void
) => {
	const token = getTokenFromHeaders(req);

	if (token) {
		_isTokenRevoked(token, (err: any, isRevoked: boolean) => {
			if (err) {
				done(null, true);
			} else {
				done(null, isRevoked);
			}
		});
	} else {
		const isRevoked = true;
		done(null, isRevoked);
	}
};

const withUser = (req: Request, res: Response, next: NextFunction) => {
	const { id: userId } = req.payload;
	User.findById(userId).exec((error, user) => {
		if (error) {
			res.status(500).send({ message: 'Unable to find user' });
		} else {
			// eslint-disable-next-line
			res.locals.user = user;
			next();
		}
	});
};

const withUserOptional = (req: Request, res: Response, next: NextFunction) => {
	const { id: userId } = req.payload;
	if (!userId) {
		next();
	} else {
		withUser(req, res, next);
	}
};

const withClient = (req: Request, res: Response, next: NextFunction) => {
	const { id } = req.payload;
	ClientModel.findOne({ moderators: id }).then((client) => {
		if (client) {
			res.locals.client = client;
			next();
		} else {
			res.json({ success: false });
		}
	});
};

const withClientOptional = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { role } = req.payload;
	if (role === 'moderator') {
		withClient(req, res, next);
	} else {
		next();
	}
};

const createWithUser =
	(select: any) => (req: Request, res: Response, next: NextFunction) => {
		const { id: userId } = req.payload;
		User.findById(userId)
			.select(select)
			.exec((error, user) => {
				if (error) {
					res.status(500).send({
						message: 'Database error occurred while searching for user',
						code: 'database-error',
					});
				} else {
					// eslint-disable-next-line
					res.locals.user = user;
					next();
				}
			});
	};

const maxCookieAge = 60 * 24 * 60 * 60 * 1000;
const refreshToken = (req: Request, res: Response, next: NextFunction) => {
	const { user } = res.locals;
	blacklistAll(user._id, undefined, (error: Error) => {
		user.generateJWT(req).then((token: string) => {
			res.cookie('auth', token, {
				domain: getCookieHostName(req),
				maxAge: maxCookieAge,
			});
			if (error) {
				next(new APIError('Failed to blacklist tokens', 500));
			} else {
				next();
			}
		});
	});
};

export default {
	required: jwt({
		algorithms: ['HS256'],
		secret: process.env.JWT_SECRET,
		requestProperty: 'payload',
		getToken: getTokenFromHeaders,
		isRevoked: isTokenRevoked,
	}),
	optional: jwt({
		algorithms: ['HS256'],
		secret: process.env.JWT_SECRET,
		requestProperty: 'payload',
		getToken: getTokenFromHeaders,
		credentialsRequired: false,
	}),
	isAtLeastMentor,
	isModerator,
	isAdmin,
	isSuper,
	withUser,
	withUserOptional,
	withClientOptional,
	createWithUser,
	createRoleValidator,
	refreshToken,
};
