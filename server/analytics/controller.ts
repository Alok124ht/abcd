import AssessmentWrapper from '../assessment/assessmentWrapper.model';
import { Types } from 'mongoose';
import {
	getUser,
	getMaxMarks,
	filterSubmissionForPhase,
	getUserIdsByPhase,
} from './utils';
import WrapperAnalysisModel from '../assessment/wrapperAnalysis.model';
import UserModel from '../user/user.model';
import { UserRole } from '../user/IUser';
import submissionModel from '../assessment/submission.model';
import ClientModel from '../client/client.model';
import { forEach, toString } from 'lodash';
import useraccountModel from '../user/useraccount.model';
import UserVideoStat from '../learningCenter/models/UserVideoStat';
import Video from '../learningCenter/models/Video';
import logger from '../../config/winston';
const { ObjectId } = Types;

export const overallAnalysis = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { user } = req.body;
	if (!user) res.send({ success: false, message: 'User is must required' });
	try {
		submissionModel
			.find({
				user,
				graded: true,
			})
			.select(
				'assessmentWrapper coreAnalysis wrapperAnalysis meta.marks meta.questionsAttempted meta.correctQuestions meta.correctTime meta.incorrectTime meta.unattemptedTime meta.precision meta.marksGained meta.marksLost'
			)
			.populate([
				{ path: 'assessmentWrapper', select: 'name' },
				{ path: 'coreAnalysis', select: 'maxMarks' },
				{
					path: 'assessmentCore',
					select: 'duration syllabus.topics._id sections.questions.question',
				},
			])
			.then(async (result) => {
				res.status(200).send(result);
			})
			.catch((err) => {
				res.send({ success: false, message: 'Database fetching error', err });
			});
	} catch (err) {
		res.send({ success: false, message: 'Internal server error', err });
	}
};

export const overallAnalysisPhase = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { phase } = req.body;
		const users = await getUserIdsByPhase(phase);
		const submissions = await submissionModel
			.find({
				user: { $in: users },
				graded: true,
			})
			.select(
				'assessmentWrapper coreAnalysis wrapperAnalysis meta.marks meta.questionsAttempted meta.correctQuestions meta.correctTime meta.incorrectTime meta.unattemptedTime meta.precision meta.marksGained meta.marksLost'
			)
			.populate([
				{ path: 'assessmentWrapper', select: 'name' },
				{ path: 'coreAnalysis', select: 'maxMarks' },
				{
					path: 'assessmentCore',
					select: 'duration syllabus.topics._id sections.questions.question',
				},
			]);
		res.status(200).send(filterSubmissionForPhase(submissions));
	} catch (err) {
		res.status(500).send({ message: 'Internal server error', err });
	}
};

export const getUserMarks = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { assessmentId } = req.params;
	try {
		const marks: any = [];

		const wrapper = await AssessmentWrapper.findById({
			_id: ObjectId(assessmentId),
		}).select('analysis name');

		const analysis = await WrapperAnalysisModel.findById({
			_id: wrapper.analysis,
		}).select('marks');

		for (var i = 0; i < analysis.marks.length; i++) {
			marks.push({
				marks: analysis.marks[i].marks,
				user: await getUser(analysis.marks[i].user),
			});
		}

		const maxMarks = await getMaxMarks(assessmentId);

		res.status(200).send({
			name: wrapper.name,
			maxMarks,
			marks,
		});
	} catch (e) {
		res.status(500).send({ message: 'Internal Server Error' });
	}
};

export const getUserInPhase = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { phase } = req.params;
	UserModel.find(
		{
			'subscriptions.subgroups.phases.phase': ObjectId(phase),
			role: UserRole.USER,
		},
		{
			name: 1,
			dp: 1,
		}
	)
		.then((result) => {
			res.status(200).send(result);
		})
		.catch((e) => {
			res.status(500).send({ message: 'Internal server error...' });
		});
};

export const getUserData = (req: ExpressRequest, res: ExpressResponse) => {
	const { userId } = req.params;
	UserModel.findById(userId)
		.select(
			'dp name email subscriptions.subgroups.phases.phase username mobileNumber role oldPhases'
		)
		.populate([
			{
				path: 'subscriptions.subgroups.phases.phase',
				select: 'name',
			},
			{
				path: 'oldPhases',
				select: 'name',
			},
		])
		.then((user) => res.send(user))
		.catch((err) =>
			res.send({ success: false, msg: 'Error while loading data' })
		);
};

export const getFullAssessments = (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { userId } = req.params;
	let { q, limit } = req.body;
	if (!limit) {
		limit = 10;
	}
	if (!q) {
		q = {};
	}
	submissionModel
		.find({ user: userId, ...q })
		.select('assessmentWrapper assessmentCore coreAnalysis meta createdAt')
		.populate([
			{
				path: 'assessmentWrapper',
				select: 'name type availableFrom availableTill',
			},
			{
				path: 'assessmentCore',
				select: 'sections',
			},
			{
				path: 'coreAnalysis',
				select: 'maxMarks',
			},
		])
		.sort({ createdAt: -1 })
		.limit(limit)
		.then((submissions) => {
			const response: any[] = [];
			submissions.forEach((submission) => {
				let totalQuestions = 0;
				submission.meta.sections.forEach((section) => {
					totalQuestions += section.questions.length;
				});
				response.push({
					// @ts-ignore
					...submission.assessmentWrapper._doc,
					...submission.meta,
					createdAt: submission.createdAt,
					assessmentCore: {
						// @ts-ignore
						...submission.assessmentCore._doc,
					},
					// @ts-ignore
					maxMarks: submission.coreAnalysis.maxMarks,
					totalQuestions,
				});
			});
			res.send(response);
		})
		.catch((err) =>
			res.send({ success: false, msg: 'Error while loading submissions' })
		);
};

export const getUserIdsAsPerAccess = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	const { id: userId, role } = req.payload;
	const phases: string[] = [];
	const query: any = {};
	const result: string[] = [];
	const moderators: string[] = [];
	if (role === 'moderator') {
		const client = await ClientModel.findOne({ moderators: userId }).select(
			'phases moderators'
		);
		forEach(client.phases, (phase) => {
			phases.push(toString(phase));
		});
		forEach(client.moderators, (moderator) => {
			moderators.push(toString(moderator));
		});
	} else if (role === 'mentor') {
		const userAccount = await useraccountModel
			.findOne({ users: userId })
			.populate({
				path: 'users',
				select: 'subscriptions.subgroups.phases.phase',
			});
		if (userAccount) {
			forEach(userAccount.users, (user) => {
				forEach(user.subscriptions, (subs) => {
					forEach(subs.subgroups, (sub) => {
						forEach(sub.phases, (phase) => {
							phases.push(toString(phase));
						});
					});
				});
			});
		} else {
			const user = await UserModel.findById(userId).select(
				'subscriptions.subgroups.phases.phase'
			);
			if (user) {
				forEach(user.subscriptions, (subs) => {
					forEach(subs.subgroups, (sub) => {
						forEach(sub.phases, (phase) => {
							phases.push(toString(phase));
						});
					});
				});
			}
		}
	}

	if (role === 'moderator' || role === 'mentor') {
		if (phases.length === 0) {
			res.send({ success: false, msg: 'You do not have appropriate access' });
			return;
		}
		query['subscriptions.subgroups.phases.phase'] = { $in: phases };
		const users = await UserModel.find(query).select('_id');
		if (users.length === 0) {
			res.send({ success: false, msg: 'Users not found in the phase' });
			return;
		}
		forEach(users, (user) => {
			result.push(toString(user._id));
		});
	}

	return { phases, users: result, moderators };
};

export const userVideoStats = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { role } = req.payload;
		const searchUser = role === 'mentor' || role === 'moderator';
		const { users, phases, moderators } = await getUserIdsAsPerAccess(req, res);

		const stats = await UserVideoStat.find(
			searchUser ? { u: { $in: users } } : {}
		).select('wt iw progress createdAt');

		const videos = await Video.find(
			searchUser ? { createdBy: { $in: moderators } } : {}
		);

		res.send({ success: true, stats, videos });
	} catch (err) {
		logger.info(err);
		res.send({
			success: false,
			msg: 'Error while loading analytics',
			error: err,
		});
	}
};

export const userAssessmentStats = async (
	req: ExpressRequest,
	res: ExpressResponse
) => {
	try {
		const { role } = req.payload;
		const searchUser = role === 'mentor' || role === 'moderator';
		const { phases, users } = await getUserIdsAsPerAccess(req, res);

		const wrappers = await AssessmentWrapper.find(
			searchUser ? { 'phases.phase': { $in: phases } } : {}
		).select('createdAt label onlyCBT');

		const submissions = await submissionModel
			.find(searchUser ? { user: { $in: users } } : {})
			.select('createdAt -_id user wrapper');

		res.send({ success: true, submissions, wrappers });
	} catch (err) {
		logger.info({
			error: err,
			message: 'Error on fetching user assessment stats',
		});
		res.send({ success: false, msg: 'Error while loading data' });
	}
};
