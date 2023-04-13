import { forEach, get } from 'lodash';
import UserModel from '../user.model';
import useraccountModel from '../useraccount.model';

const getUserAccount = async (email: string | any) => {
	try {
		let userAccountRes: any = null;
		const userAccount = await useraccountModel
			.findOne({
				email: email,
			})
			.populate({
				path: 'users',
				select: 'dp _id email mobileNumber subscriptions isVerified',
				populate: {
					path: 'subscriptions.subgroups.phases.phase',
					select: 'name startDate endDate active',
				},
			});
		if (!userAccount) {
			userAccountRes = null;
		} else {
			userAccountRes = [];
			forEach(userAccount.users, (user: any) => {
				let phases: any = [];
				forEach(user.subscriptions, (subs) => {
					forEach(subs.subgroups, (sub) => {
						forEach(sub.phases, (ph) => {
							const phase = get(ph, 'phase', null);
							if (phase) {
								if (phase.active) {
									phases.push({
										_id: phase._id,
										name: phase.name,
									});
								}
							}
						});
					});
				});
				userAccountRes.push({
					_id: user._id,
					dp: user.dp,
					email: user.email,
					mobileNumber: user.mobileNumber,
				});
			});
		}
		return userAccountRes;
	} catch (err) {
		return null;
	}
};

const getUser = async (email: string) => {
	try {
		const user = await UserModel.findOne({
			$or: [{ email, emailIdentifier: email }],
		}).populate({
			path: 'subscriptions.subgroups.phases.phase',
		});
		return user;
	} catch (err) {
		return null;
	}
};

export const signin = async (req: ExpressRequest, res: ExpressResponse) => {
	const { email, password } = req.body;
	try {
		const userAccount = await useraccountModel.findOne({
			$or: [{ email }, { emailIdentifier: email }],
		});
		if (userAccount) {
			// user account found
			if (userAccount.validatePassword(password)) {
				res.send({
					success: true,
					field: null,
					code: 'success',
					user: await getUser(email),
					userAccount: await getUserAccount(email),
				});
			} else {
				// user account found but password not matched
				res.send({ success: false, field: 'password', code: 'wrong-password' });
			}
		} else {
			// user account not found that means it could be simple user as well
			const user = await getUser(email);
			if (user) {
				// if user is there then check for password
				if (user.validatePassword(password)) {
					// user found and password matched
					res.send({
						success: true,
						field: null,
						code: 'success',
						user,
						userAccount: null,
					});
				} else {
					// user found but password not matched
					res.send({ success: false, field: 'password', code: 'wrong-password' });
				}
			} else {
				// user not found with the email, sorry 🙂
				res.send({ success: false, code: 'not-found', field: 'email' });
			}
		}
	} catch (err) {
		res.send({ success: false, field: null, code: 'code-exception' });
	}
};
