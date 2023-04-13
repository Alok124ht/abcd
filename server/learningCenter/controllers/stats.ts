import { NextFunction, Response } from 'express';
import { Types } from 'mongoose';
import { PlaylistWithItemPopulated } from '../../types/Playlist';
import AssignmentSubmissionModel from '../../assignment/models/AssignmentSubmission';
import APIError from '../../helpers/APIError';
import { Request } from '../../types/Request';
import User from '../../user/user.model';
import PlaylistModel from '../models/Playlist';
import UserVideoStat from '../models/UserVideoStat';

export const getVideoDataByPhases = async (
	req: Request,
	res: Response & { locals: { phases: string[] } },
	next: NextFunction
) => {
	const { phases }: { phases: string[] } = res.locals;
	const { phases: phaseIds } = req.query;
	if (!Array.isArray(phaseIds)) {
		next(new APIError('phases must be an array'));
		return;
	}
	if (
		!phaseIds ||
		!phaseIds.some((phaseId) =>
			phases.some((phase) => phase.toString() === phaseId)
		)
	) {
		next(new APIError('You do not have permission for this phase'));
		return;
	}
	const users = await User.find(
		{
			'subscriptions.subgroups.phases.phase': { $in: phaseIds },
		},
		'email'
	);
	const userVideoStats = await UserVideoStat.find(
		{ u: { $in: users.map((u) => u._id) } },
		'v u wt'
	)
		.populate({ path: 'v', select: 'title' })
		.exec();
	res.send({
		users: users.map((u) => u.toObject()),
		stats: userVideoStats.map((s) => s.toObject()),
	});
};

export async function submissionGraphForPhase(
	req: ExpressRequest,
	res: ExpressResponse,
	next: ExpressNextFunction
) {
	const phase = req.params.phase;
	try {
		const playlists = ((await PlaylistModel.find({
			accessibleTo: { $elemMatch: { type: 'Phase', value: phase } },
		}).populate({
			path: 'items',
		})) as unknown) as PlaylistWithItemPopulated[];
		const assignmentIds: Types.ObjectId[] = [];
		playlists.forEach((playlist) => {
			playlist.items.forEach((item) => {
				assignmentIds.push(item.resource);
			});
		});

		const submissions = await AssignmentSubmissionModel.find(
			{ _id: assignmentIds },
			{ createdAt: 1 }
		);
		res.send({ assignmentIds, submissions });
	} catch (e) {
		next(e);
	}
}
