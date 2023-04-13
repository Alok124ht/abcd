import { Schema, Model, model, Types, Document } from 'mongoose';
import { getDeviceLimit } from '../utils/phase';
import { clearMany } from '../cache/Token';
import { Request } from '../types/Request';
import User from '../user/user.model';
import logger from '../../config/winston';

const ObjectId = Schema.Types.ObjectId;

const logoutReasonsByKey = {
	DLE: 'Device Limit Exceeded',
	LAD: 'Logout of All Devices',
	AUS: 'Account user switch',
};

const logoutReasonEnums = Object.keys(logoutReasonsByKey);

interface BaseToken extends Document {
	token: string;
	isBlacklisted?: boolean;
	userAgent?: string;
	logoutUserAgent?: string;
	blacklistedAt?: Date;
	r: string;
	createdAt: Date;
	updatedAt: Date;
	ip: String;
	logoutIp: String;
}

interface IToken extends BaseToken {
	user: Types.ObjectId;
}

interface ITokenModel extends Model<IToken> {
	isTokenRevoked(token: string): boolean;
	blacklist(
		this: ITokenModel,
		jwt: string,
		userId: Types.ObjectId,
		userAgent: string,
		options?: object
	): Promise<void>;
}

const TokenSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
		},
		token: {
			type: String,
			required: true,
			index: true,
		},
		isBlacklisted: {
			type: Boolean,
			default: false,
		},
		ip: String,
		userAgent: String,
		logoutUserAgent: String,
		logoutIp: String,
		blackListedAt: {
			type: Date,
		},
		// reason of logout
		r: {
			type: String,
			enum: logoutReasonEnums,
		},
	},
	{ timestamps: true }
);

TokenSchema.statics = {
	blacklist(
		this: ITokenModel,
		jwt: string,
		userId: Types.ObjectId,
		userAgent: string,
		options?: object
	): Promise<void> {
		return new Promise((resolve, reject) => {
			this.updateOne(
				{ token: jwt, user: userId },
				{
					isBlacklisted: true,
					logoutUserAgent: userAgent,
					blackListedAt: Date.now(),
				}
			).exec((error, writeOpResult) => {
				if (error) {
					reject(error);
				} else if (writeOpResult.n === 0) {
					const token = new this();
					token.set({
						token: jwt,
						user: userId,
						isBlacklisted: true,
						logoutUserAgent: userAgent,
						userAgent: '',
						blacklistedAt: new Date(),
						...options,
					});
					token
						.save()
						.then(() => {
							resolve();
						})
						.catch(reject);
				} else {
					resolve();
				}
			});
		});
	},

	isTokenRevoked(this: ITokenModel, jwt: string): Promise<boolean> {
		// is not moved to cache/Token.js
		return new Promise((resolve) => {
			this.findOne({ token: jwt }).exec((error, searchedToken) => {
				if (error || !searchedToken || searchedToken.isBlacklisted) {
					// TODO: use error || !searchedToken || searchedToken.isBlacklisted
					return resolve(true);
				}
				return resolve(false);
			});
		});
	},
};

TokenSchema.post('save', async function postSave(this: IToken) {
	const Log = model('Log');
	try {
		const user = await User.findById(this.user, 'role subscriptions');
		if (!['moderator', 'admin', 'super'].includes(user.role)) {
			getDeviceLimit(user).then((deviceLimit) => {
				if (deviceLimit !== Infinity) {
					const M = model<IToken>('Token');
					M.find({ user: user._id, isBlacklisted: false })
						.select('token')
						.sort({ createdAt: -1 })
						.skip(deviceLimit)
						.then((tokens) => {
							if (tokens.length) {
								M.updateMany(
									{ _id: { $in: tokens.map((token) => token._id) } },
									{
										$set: {
											isBlacklisted: true,
											blackListedAt: Date.now(),
											r: 'DLE',
										},
									}
								)
									.then(() => {
										clearMany(
											tokens.map((token) => token.token),
											(tokenClearError: Error) => {
												if (tokenClearError) {
													Log.create({
														user: user._id,
														role: user.role,
														api: 'Post Token Creation',
														params: {
															error:
																tokenClearError && tokenClearError.message
																	? tokenClearError.message
																	: 'Unknown error while clearing token from cache',
															deviceLimit,
															NTR: tokens.length,
															// number of tokens to remove
														},
													});
												}
											}
										);
									})
									.catch((tokenUpdateError) => {
										logger.error(
											`Failed to apply device limit. ${user._id} ${
												tokenUpdateError && tokenUpdateError.message
											}`
										);
										Log.create({
											user: user._id,
											role: user.role,
											api: 'Post Token Creation',
											params: {
												error:
													tokenUpdateError && tokenUpdateError.message
														? tokenUpdateError.message
														: 'Unknown error marking token as revoked',
												deviceLimit,
												NTR: tokens.length,
												// number of tokens to remove
											},
										});
									});
							}
						})
						.catch((tokenSearchError) => {
							logger.error(
								`Failed to apply device limit. ${user._id} ${
									tokenSearchError && tokenSearchError.message
								}`
							);
							Log.create({
								user: user._id,
								role: user.role,
								api: 'Post Token Creation',
								params: {
									error:
										tokenSearchError && tokenSearchError.message
											? tokenSearchError.message
											: 'Unknown error while searching tokens in db',
									deviceLimit,
								},
							});
						});
				}
			});
		}
	} catch (error) {
		logger.info(
			`failed to get user ${this.user} in TokenScheme.post; error: ${error.message}`
		);
	}
});

export default model<IToken, ITokenModel>('Token', TokenSchema);
