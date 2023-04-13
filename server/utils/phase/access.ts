import { some } from 'lodash';
import { Types } from 'mongoose';
import { UserSubscription } from '../../user/IUser';

export const subscriptionsIncludePhase = (
	subscriptions: UserSubscription[],
	phase: string | Types.ObjectId
) =>
	some(subscriptions, (subscription) =>
		some(subscription.subgroups, (subGroup) =>
			some(subGroup.phases, (phaseWrapper) => phaseWrapper.phase.equals(phase))
		)
	);
