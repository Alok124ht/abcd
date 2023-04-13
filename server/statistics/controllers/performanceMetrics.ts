import { NextFunction, Response } from 'express';
import Papa from 'papaparse';
import { get } from 'lodash';
import UserCategoryModel from '../../user/usercategory.model';
import { Request } from '../../types/Request';
import SubmissionModel from '../../assessment/submission.model';
import SubmissionKPIModel from '../../models/SubmissionKPI';
import APIError from '../../helpers/APIError';

export async function getPerformanceFiles(
	req: Request,
	res: Response,
	next: NextFunction
) {
	try {
		const { limit: limitRaw, skip: skipRaw } = req.query;
		if (typeof limitRaw !== 'string' || typeof skipRaw !== 'string') {
			res.send('limit and skip are required');
			return;
		}
		const limit = parseInt(limitRaw, 10);
		const skip = parseInt(skipRaw, 10);

		const kpis = await SubmissionKPIModel.find()
			.skip(skip)
			.limit(limit)
			.select({
				stamina: 1,
				selectivity: 1,
				endurance: 1,
				intent: 1,
				marks: 1,
				maxMarks: 1,
				_id: -1,
			})
			.exec();

		const data = kpis
			.map((kpi) => kpi.toObject())
			.map(({ intent, stamina, selectivity, endurance, marks, maxMarks }) => ({
				intent,
				stamina,
				selectivity,
				endurance,
				score: Number.isNaN(maxMarks)
					? 'NA'
					: Math.round((1e4 * marks) / maxMarks) / 100,
			}));
		res.type('text/csv');
		res.send(Papa.unparse(data));
	} catch (e) {
		next(new APIError(e, 500, true));
	}
	return;
	try {
		const userCategories = await UserCategoryModel.find()
			.select(
				'assessments.assessment assessments.stamina assessments.selectivity user'
			)
			.skip(skip)
			.limit(limit)
			.exec();
		const allItems: any[] = [];
		userCategories.forEach((category) => {
			category.assessments.forEach((assessmentCategoryData) => {
				if (assessmentCategoryData.assessment) {
					allItems.push({
						...assessmentCategoryData.toObject(),
						user: category.user,
					});
				}
			});
		});
		const allSubmissions = await SubmissionModel.find().select(
			'user assessmentWrapper meta.marks'
		);
		const submissionsByUserByAssessmentWrapper = {};
		allSubmissions.forEach((submission) => {
			if (!submissionsByUserByAssessmentWrapper[submission.assessmentWrapper]) {
				submissionsByUserByAssessmentWrapper[submission.assessmentWrapper] = {};
				submissionsByUserByAssessmentWrapper[submission.assessmentWrapper][
					submission.user
				] = get(submission, ['meta', 'marks']);
			}
		});

		allItems.forEach((item) => {
			item.marks = get(
				submissionsByUserByAssessmentWrapper,
				[item.assessment, item.user],
				null
			);
		});
		const itemsWithMarks = allItems.filter((item) => item.marks !== null);

		res.type('text/csv');
		res.send(
			Papa.unparse(
				itemsWithMarks.map((i) => ({
					selectivity: i.selectivity,
					stamina: i.stamina,
					marks: i.marks,
				}))
			)
		);
	} catch (e) {
		next(e);
	}
}
