import { model, Types } from 'mongoose';
import { getStrippedEmail } from '../../utils/user/email';
import { IUserModel, UserSubscription } from '../IUser';
import UserModel from '../user.model';
import ClientModel from '../../client/client.model';
import { get } from 'lodash';
import { Client } from '../../types/Client';

export function getDefaultUser(
	email: string,
	password: string,
	name: string,
	dp: string,
	isVerified: boolean,
	subscriptions: UserSubscription[]
) {
	const User = model('User') as IUserModel;
	const user = new User({
		email,
		emailIdentifier: getStrippedEmail(email),
		name,
		mobileNumber: '',
		milestones: [
			{
				achievement: 'Joined Prepseed',
				key: '',
				date: new Date(),
			},
		],
		subscriptions,
		username: `NOTSET_${email}`,
		settings: {
			sharing: false,
			goal: [{ date: new Date().toString(), goal: 1 }],
		},
		isVerified: !!(process.env.NODE_ENV === 'development' || isVerified),
		dp,
	});
	user.milestones[0].key = user._id;
	user.setPassword(password);
	return user;
}

export async function getDefaultSubscriptionFromPhase(
	superGroupId: string | Types.ObjectId,
	subGroupId: string | Types.ObjectId,
	phaseId: string | Types.ObjectId
): Promise<{ subscriptions?: UserSubscription[]; error?: string }> {
	if (!superGroupId || !subGroupId || !phaseId) {
		return Promise.resolve({ error: 'unknown' });
	}
	const phaseObjectId =
		typeof phaseId === 'string' ? Types.ObjectId(phaseId) : phaseId;
	const subGroupObjectId =
		typeof subGroupId === 'string' ? Types.ObjectId(subGroupId) : subGroupId;
	const subGroupString =
		typeof subGroupId === 'string' ? subGroupId : subGroupId.toString();
	const superGroupString =
		typeof superGroupId === 'string' ? superGroupId : superGroupId.toString();
	const Phase = model('Phase');
	const phase = await Phase.findOne({
		supergroup: superGroupString,
		'subgroups.subgroup': subGroupObjectId,
		_id: phaseObjectId,
	});
	if (phase) {
		return {
			subscriptions: [
				{
					group: superGroupString,
					subgroups: [
						{
							group: subGroupString,
							phases: [{ phase: phaseObjectId, active: true, isAccessGranted: true }],
						},
					],
				},
			],
			error: null,
		};
	}
	return { error: 'unknown', subscriptions: null };
}

export const getClientOfUser: (
	userId: string
) => Promise<{ error: boolean; client?: Client }> = async (userId: string) => {
	try {
		const user = await UserModel.findById(userId).select('_id subscriptions');
		const client = await ClientModel.findOne({
			phases: get(user, 'subscriptions[0].subgroups[0].phases[0].phase', 'abcd'),
		});
		if (!client) {
			return { error: true, client };
		}
		return { error: false, client };
	} catch (err) {
		return { error: true };
	}
};
