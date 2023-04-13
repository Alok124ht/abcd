import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import PhaseMentorModel from '../../phase/PhaseMentor';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import { Request } from '../../types/Request';
import APIError from '../../helpers/APIError';
import GroupModel from '../../models/Mentor/Group';

export async function startChatGroup(
	req: Request,
	res: Response,
	next: NextFunction
) {
	const { reason, reasonType } = req.body;
	const { id: userId } = req.payload;
	const { user } = res.locals;
	const phases = getActivePhasesFromSubscriptions(user.subscriptions);
	if (reasonType === 'PhaseMentor') {
		try {
			const phaseMentor = await PhaseMentorModel.findOne({
				phase: { $in: phases },
				_id: reason,
			});
			if (!phaseMentor) {
				next(new APIError('You can not start this chat.', 422, true));
			} else {
				const existingGroup = await GroupModel.findOne({
					$and: [
						{ members: phaseMentor.user },
						{
							members: Types.ObjectId(userId),
						},
					],
				});
				if (existingGroup) {
					// next(new APIError('Group already created'));
					res.send({ group: existingGroup });
					return;
				}
				const group = new GroupModel({});
				group.members = [phaseMentor.user, Types.ObjectId(userId)];
				await group.save();
				res.send({ message: 'Yayyyyy!!!!!', group });
			}
		} catch (e) {
			next(e);
		}
	}
}
