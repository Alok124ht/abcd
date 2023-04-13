import { Types } from 'mongoose';
import { NextFunction, Response } from 'express';
import { get } from 'lodash';
import UserCategoryModel from '../../user/usercategory.model';
import { Request } from '../../types/Request';
import SubmissionKPIModel, {
	SubmissionKPIBase,
} from '../../models/SubmissionKPI';
import AssessmentWrapper from '../../assessment/assessmentWrapper.model';
import { getMaxMarks } from '../../lib';
import { ISubmission } from '../../types/Submission';
import submissionModel from '../../assessment/submission.model';
import { intentModel } from '../../MLModels/intentModel';
import APIError from '../../helpers/APIError';

export async function migrateFromUserCategory(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const limit = parseInt(req.body.limit, 10);
		const skip = parseInt(req.body.skip, 10);
		const beforeDate = req.body.migratedBeforeDate;
		const allUserCategoriesIds: Types.ObjectId[] = [];
		const userCategories = await UserCategoryModel.find({
			$or: [
				{ migratedToSubKpiAt: { $exists: false } },
				{ migratedToSubKpiAt: { $lte: new Date(beforeDate) } },
			],
			'assessments.0': { $exists: true },
		})
			.select(
				'assessments.assessment assessments.stamina assessments.selectivity user'
			)
			.skip(skip)
			.limit(limit);
		if (!userCategories.length) {
			res.send({ message: 'Nothing to migrate' });
		}
		const allAssessmentWrapperIds: Types.ObjectId[] = [];
		const allAssessmentWrappersByIds: { [wrapperId: string]: boolean } = {};
		const submissionFindQuery: Pick<
			ISubmission,
			'assessmentWrapper' | 'user'
		>[] = [];

		userCategories.forEach((category) => {
			allUserCategoriesIds.push(category._id);
			category.assessments.forEach((assessment) => {
				if (!allAssessmentWrappersByIds[assessment.assessment.toString()]) {
					allAssessmentWrappersByIds[assessment.assessment.toString()] = true;
					allAssessmentWrapperIds.push(assessment.assessment);
				}
				submissionFindQuery.push({
					assessmentWrapper: assessment.assessment,
					user: (category.user as unknown) as Types.ObjectId,
				});
			});
		});
		const submissions = await submissionModel
			.find({ $or: submissionFindQuery })
			.select('meta.marks assessmentWrapper user');
		const marksByUserWrapper: {
			[key: string]: { marks: number; submission: Types.ObjectId };
		} = {};
		submissions.forEach((submission) => {
			marksByUserWrapper[`${submission.user}-${submission.assessmentWrapper}`] = {
				marks: get(submission, ['meta', 'marks']),
				submission: submission._id,
			};
		});
		const allAssessmentWrappers = await AssessmentWrapper.find({
			_id: { $in: allAssessmentWrapperIds },
		})
			.select('core')
			.populate('core', 'sections sectionGroups config');
		const maxMarksByWrapperId: { [wrapperId: string]: number } = {};
		allAssessmentWrappers.forEach((wrapper) => {
			const maxMarks = getMaxMarks(wrapper.core);
			maxMarksByWrapperId[wrapper._id.toString()] = Number.isNaN(maxMarks)
				? -1
				: maxMarks;
		});
		const items: SubmissionKPIBase[] = [];
		userCategories.forEach((category) => {
			category.assessments.forEach((assessment) => {
				const key = `${category.user}-${assessment.assessment}`;
				if (key in marksByUserWrapper) {
					let endurance =
						(100.0 * assessment.correctsInTime) /
						(assessment.correctsInTime + assessment.allNotInTime);
					if (Number.isNaN(endurance)) {
						endurance = undefined;
					}

					const percent_attempt =
						(1.0 * assessment.totalAttempts) / assessment.totalQuestions;
					const percent_early_exit =
						(1.0 * assessment.earlyExitTime) / assessment.duration;
					const percent_guesses = assessment.totalAttempts
						? (1.0 * assessment.totalTooFastAttempts) / assessment.totalAttempts
						: 1;
					const percent_idle =
						assessment.duration - assessment.earlyExitTime > 0
							? (1.0 * assessment.maxIdleTime) /
							  (assessment.duration - assessment.earlyExitTime)
							: 1;

					const intent =
						Math.round(
							100 *
								Math.max(
									0,
									Math.min(
										100,
										100 *
											intentModel([
												percent_attempt,
												percent_early_exit,
												percent_guesses,
												percent_idle,
											])[0]
									)
								)
						) / 100;
					const item: SubmissionKPIBase = {
						...assessment,
						maxMarks: maxMarksByWrapperId[assessment.assessment.toString()],
						selectivity: assessment.selectivity,
						stamina: assessment.stamina,
						endurance,
						user: (category.user as unknown) as Types.ObjectId,
						assessmentWrapper: assessment.assessment,
						marks: marksByUserWrapper[key].marks,
						submission: marksByUserWrapper[key].submission,
						intent,
					};
					items.push(item);
				}
			});
		});

		await SubmissionKPIModel.insertMany(items);
		const nModified = await UserCategoryModel.updateMany(
			{ _id: { $in: allUserCategoriesIds } },
			{ $set: { migratedToSubKpiAt: new Date() } }
		);
		res.send({
			success: true,
			inserted: items.length,
			userCategories: userCategories.length,
			submissions: submissions.length,
			nModified,
		});
	} catch (e) {
		next(new APIError(e, 500, true));
	}
}
