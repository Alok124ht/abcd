import { model, Types } from 'mongoose';
import { getStrippedEmail } from '../../utils/user/email';
import { IUserModel, UserSubscription } from '../IUser';

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
				achievement: 'Joined Prepleaf',
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
