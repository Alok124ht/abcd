import { Response, Request, NextFunction } from 'express';
import ClientModel from '../../client/client.model';
import SubGroupModel from '../../group/subGroup.model';
import SuperGroupModel from '../../group/superGroup.model';
import UserModel from '../../user/user.model';
import SubjectModel from '../../models/Subject';
import AssessmentWrapper from '../../assessment/assessmentWrapper.model';
import questionModel from '../../question/question.model';
import submissionModel from '../../assessment/submission.model';
import { gradeSubmission } from '../../assessment/gradeLib';
import { getActivePhasesFromSubscriptions } from '../../utils/phase';
import WrapperAnalyst from '../../globals/WrapperAnalyst';
import { dateToEndTime, dateToStartTime } from '../../utils/date';

export const getPhases = (req: Request, res: Response, next: NextFunction) => {
	// @ts-ignore
	const { client } = req.payload;
	ClientModel.findById(client)
		.populate([
			{
				path: 'phases',
				match: { endDate: { $gte: new Date() } },
			},
		])
		.then((phases) => {
			res.send({ success: true, phases: phases.phases });
		})
		.catch((err) => {
			res.send({ success: false });
		});
};

export const getSupergroups = async (req: Request, res: Response) => {
	SuperGroupModel.find()
		.then((supers) => {
			res.send({ success: true, supergroups: supers });
		})
		.catch((err) => {
			res.send({ success: false });
		});
};

export const getSubgroups = async (req: Request, res: Response) => {
	// @ts-ignore
	const { client } = req.payload;

	const clientInfo = await ClientModel.findById(`${client}`);

	SubGroupModel.find({ 'phases.phase': { $in: clientInfo.phases } })
		.sort({ createdAt: 1 })
		.then((subgroups) => {
			if (!subgroups) {
				res.send({ success: false });
			} else {
				res.send({ success: true, subgroups });
			}
		})
		.catch((err) => res.send({ success: false }));
};

export const getUsers = (req: Request, res: Response) => {
	const { phase } = req.body;

	UserModel.find(
		{
			'subscriptions.subgroups.phases.phase': { $in: phase },
			// @ts-ignore
			role: 'user',
			isArchived: { $ne: true },
		},
		{
			stats: 0,
			session: 0,
			streak: 0,
			client: 0,
			xp: 0,
			netXp: 0,
			settings: 0,
			bookmarks: 0,
			portal: 0,
			milestones: 0,
			oldPhases: 0,
			batchHistory: 0,
			demoStep: 0,
			version: 0,
			label: 0,
			dp: 0,
			thumbnail: 0,
			liveAssessment: 0,
		}
	)
		.then((users) => {
			res.send({ success: true, users });
		})
		.catch((err) => {
			res.send({ success: false });
		});
};

export const getSubjects = (req: Request, res: Response) => {
	SubjectModel.find({})
		.then((subjects) => {
			res.send({ success: true, subjects });
		})
		.catch((err) => {
			res.send({ success: false });
		});
};

export const getCore = async (req: Request, res: Response) => {
	const wrapperSelect =
		'name type availableFrom availableTill visibleFrom expiresOn phases description createdAt updatedAt';
	let { id } = req.body;
	const wrapper = await AssessmentWrapper.findById(id)
		.select(wrapperSelect)
		.populate({
			path: 'core',
			select:
				'sections instructions sectionInstructions customInstructions duration',
		});

	if (!wrapper) {
		res.send({ success: false, msg: 'Wrapper not found' });
		return;
	}

	const phaseList: any[] = [];
	wrapper.phases.forEach((phase) => {
		phaseList.push(phase.phase.toString());
	});

	let core = {
		_id: wrapper._id,
		name: wrapper.name,
		type: wrapper.type,
		availableFrom: wrapper.availableFrom,
		availableTill: wrapper.availableTill,
		visibleFrom: wrapper.visibleFrom,
		expiresOn: wrapper.expiresOn,
		phases: phaseList,
		description: wrapper.description,
		createdAt: wrapper.createdAt,
		updatedAt: wrapper.updatedAt,
		// @ts-ignore
		sections: wrapper.core.sections,
		// @ts-ignore
		instructions: wrapper.core.instructions,
		// @ts-ignore
		sectionInstructions: wrapper.core.sectionInstructions,
		// @ts-ignore
		customInstructions: wrapper.core.customInstructions,
		// @ts-ignore
		duration: wrapper.core.duration,
		// @ts-ignore
		core: wrapper.core._id,
	};

	res.send({ success: true, core });
};

export const getQuestions = (req: Request, res: Response) => {
	const { questions } = req.body;
	questionModel
		.find({
			_id: { $in: questions },
		})
		.select(
			'content options multiOptions columns type level hint hasImage hasEquation link dataType'
		)
		.then((questions) => {
			if (questions) {
				res.send({ success: true, questions });
			} else {
				res.send({ success: false, msg: "Can't get questions" });
			}
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while loading questions' });
		});
};

export const submitAssessment = async (req: Request, res: Response) => {
	try {
		const { flow, submitFor, wrapper, sections } = req.body;

		const dbUser = await UserModel.findById(submitFor);

		const userPhases = getActivePhasesFromSubscriptions(dbUser.subscriptions);

		const dbWrapper = await AssessmentWrapper.findById(wrapper).populate([
			{
				path: 'analysis',
			},
			{
				path: 'core',
				populate: {
					path: 'analysis',
				},
			},
		]);

		const newSubmission = new submissionModel();
		newSubmission.user = submitFor;
		newSubmission.assessmentWrapper = wrapper;
		// @ts-ignore
		newSubmission.assessmentCore = dbWrapper.core._id;
		// @ts-ignore
		newSubmission.wrapperAnalysis = dbWrapper.analysis._id;
		// @ts-ignore
		newSubmission.coreAnalysis = dbWrapper.core.analysis._id;
		newSubmission.response = { sections };
		newSubmission.originalResponse = { sections };
		newSubmission.graded = dbWrapper.graded;
		newSubmission.live = true;
		newSubmission.version = 2;
		newSubmission.isCategorized = true;
		newSubmission.attemptsUpdated = false;
		newSubmission.ignore = false;
		newSubmission.submittedBy = submitFor;
		newSubmission.flow = flow;
		newSubmission.sEvent = 'user';

		if (dbWrapper.graded) {
			// @ts-ignore
			newSubmission.meta = gradeSubmission(
				newSubmission,
				dbWrapper.core,
				// @ts-ignore
				dbWrapper.analysis.bonus,
				0,
				userPhases,
				dbWrapper.phases,
				dbWrapper.type
			);
		}

		newSubmission.save((err, saved) => {
			if (saved) {
				WrapperAnalyst.enqueueSubmissionData(
					{
						meta: newSubmission.meta,
						submissionId: saved._id,
						userId: newSubmission.user,
					},
					// @ts-ignore
					dbWrapper.analysis._id
				);
				res.send({ success: true, msg: 'Assessment Submitted', errorType: 'none' });
			} else {
				res.send({
					success: false,
					msg: 'Not inserted remote assessment',
					errorType: 'remote',
				});
			}
		});
	} catch (err) {
		res.send({
			success: false,
			msg: 'Parsing error in remote',
			errorType: 'remote',
		});
	}
};

export const getWrappers = async (req: Request, res: Response) => {
	// @ts-ignore
	const { client } = req.payload;
	const { date } = req.body;
	const startDate = dateToStartTime(date);
	const endDate = dateToEndTime(date);

	const dbClient = await ClientModel.findById(client);

	AssessmentWrapper.find({
		$and: [
			{ availableFrom: { $gte: startDate } },
			{ availableFrom: { $lte: endDate } },
		],
		'phases.phase': { $in: dbClient.phases },
	})
		.select('name phases')
		.populate('phases.phase', 'name')
		.then((wrappers) => {
			res.send({ success: true, wrappers });
		})
		.catch((err) => {
			res.send({ success: false, msg: 'Error while fetching wrappers' });
		});
};
