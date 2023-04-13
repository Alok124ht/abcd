import { size } from 'lodash';
import { model, Types } from 'mongoose';
import { subscriptionsIncludePhase } from '../../utils/phase/access';
import { IUser, IUserModel } from '../IUser';
import { UserAccountDocument, UserAccountModel } from '../types/IUserAccount';
import { getDefaultSubscriptionFromPhase, getDefaultUser } from './user';

export async function createAccount(this: IUser): Promise<UserAccountDocument> {
	const UserAccount = model('UserAccount') as UserAccountModel;
	const userAccount = new UserAccount({
		users: [this._id],
		email: this.email,
		emailIdentifier: this.emailIdentifier,
		hash: this.hash,
		salt: this.salt,
		defaultUser: this._id,
	});
	await userAccount.save();
	return userAccount;
}

export async function getAccountByUserId(
	userId: any
): Promise<UserAccountDocument> {
	const UserAccount = model('UserAccount') as UserAccountModel;
	const account = await UserAccount.findOne({ users: userId });
	if (account) {
		return account;
	}
	const User = model('User') as IUserModel;
	const user = await User.findById(userId);
	if (!user) {
		throw new Error('User not found');
	}
	return user.createAccount();
}

export async function getAccount(this: IUser): Promise<UserAccountDocument> {
	const UserAccount = model('UserAccount') as UserAccountModel;
	const account = await UserAccount.findOne({ users: this._id });
	if (!account) {
		return this.createAccount();
	}
	return account;
}

export async function addUser(
	this: UserAccountDocument,
	superGroup: string | Types.ObjectId,
	subGroup: string | Types.ObjectId,
	phase: string | Types.ObjectId
): Promise<void> {
	await this.populate('users').execPopulate();
	const lastUser: IUser = (this.users[0] as unknown) as IUser;
	const email = this.email;

	const { error, subscriptions } = await getDefaultSubscriptionFromPhase(
		superGroup,
		subGroup,
		phase
	);
	if (error) {
		throw error;
	}
	let existingUserWithNoSubscription: IUser;
	this.users.some((u) => {
		const user = (u as unknown) as IUser;
		if (!size(user.subscriptions)) {
			existingUserWithNoSubscription = user;
			return true;
		}
		return false;
	});
	if (existingUserWithNoSubscription) {
		// if there is a user with no subscription
		existingUserWithNoSubscription.subscriptions = subscriptions;
		await existingUserWithNoSubscription.save();
	} else {
		const user =
			existingUserWithNoSubscription ||
			getDefaultUser(email, 'nopassword', '', '', false, subscriptions);
		user.mobileNumber = lastUser.mobileNumber;
		user.name = lastUser.name;
		user.username = lastUser.username;
		user.isVerified = lastUser.isVerified;
		await user.save();
		this.users.push(user);
		await this.save();
	}
}

export async function createUserForPhase(
	this: UserAccountDocument,
	superGroup: Types.ObjectId,
	subGroup: Types.ObjectId,
	phase: Types.ObjectId
) {
	await this.populate('users').execPopulate();
	const users = this.users.map((user) => {
		const u = (user as unknown) as IUser;
		return u;
	});
	const existingUserOfCurrentPhase = users.filter((user: IUser) =>
		subscriptionsIncludePhase(user.subscriptions, phase)
	)[0];
	if (existingUserOfCurrentPhase) {
		console.log('user already exists for phase');
		return;
	} else {
		console.log('user not in this phase, creating user');
		await this.addUser(superGroup, subGroup, phase);
	}
}
