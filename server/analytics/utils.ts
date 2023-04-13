import UserModel from '../user/user.model';
import { Types } from 'mongoose';
import TopicModel from '../topic/topic.model';
import AssessmentWrapper from '../assessment/assessmentWrapper.model';
import { toString, toInteger } from 'lodash';
import submissionModel from '../assessment/submission.model';
const { ObjectId } = Types;

export const getUser = async (user: string) => {
	return await UserModel.findById({ _id: ObjectId(user) }).select(
		'name _id dp subscriptions.subgroups.phases.phase'
	);
};

export const getUserStats = async (user: string) => {
	return await UserModel.findById({ _id: ObjectId(user) }).select(
		'stats.difficulty stats.topics.test_performance test_performence'
	);
};

export const getUserIdsByPhase = async (phase: string) => {
	const result = await UserModel.find({
		'subscriptions.subgroups.phases.phase': ObjectId(phase),
	}).select('_id');
	const ids: any[] = [];
	result.forEach((val) => {
		ids.push(val._id);
	});
	return ids;
};

export const getMaxMarks = async (assessmentid: string) => {
	const assessment = await AssessmentWrapper.findById(
		{
			_id: ObjectId(assessmentid),
		},
		{
			core: 1,
			_id: 0,
		}
	).populate([
		{
			path: 'core',
			select: 'analysis',
			populate: {
				path: 'analysis',
				select: 'maxMarks',
			},
		},
	]);
	return await assessment.core.analysis.maxMarks;
};

export const getWrapperByPhase = async (phase: string) => {
	const wrappers = await AssessmentWrapper.find({
		'phases.phase': ObjectId(phase),
	}).select('_id name');
	return wrappers;
};

export const getTopicName = async (id: string) => {
	const topics = (
		await TopicModel.findById({
			_id: ObjectId('5c9a660e01d3a533d7c16aae'),
		}).select('topics._id topics.name')
	).topics;

	for (var i = 0; i < topics.length; i++) {
		if (toString(topics[i]._id) === id) {
			console.log(topics[i]._id);
			return {
				name: topics[i].name,
				_id: topics[i]._id,
			};
		}
	}
};

export const filterSubmissionForPhase = (submissions: any[]) => {
	const length = submissions.length;
	let marks = 0;
	let questionsAttempted = 0;
	let correctQuestions = 0;
	let correctTime = 0;
	let incorrectTime = 0;
	let unattemptedTime = 0;
	let precision = 0;
	let marksGained = 0;
	let marksLost = 0;
	let totalQuestions = 0;

	submissions.forEach((sub) => {
		sub.assessmentCore.sections.forEach((value: any) => {
			totalQuestions += value.questions.length;
		});
		marks += sub.meta.marks;
		questionsAttempted += sub.meta.questionsAttempted;
		correctQuestions += sub.meta.correctQuestions;
		correctTime += sub.meta.correctTime;
		incorrectTime += sub.meta.incorrectTime;
		unattemptedTime += sub.meta.unattemptedTime;
		precision += sub.meta.precision;
		marksGained += sub.meta.marksGained;
		marksLost += sub.meta.marksLost;
	});

	return {
		marks: marks / length,
		questionsAttempted: toInteger(questionsAttempted / length),
		correctQuestions: toInteger(correctQuestions / length),
		correctTime: correctTime / length,
		incorrectTime: incorrectTime / length,
		unattemptedTime: unattemptedTime / length,
		precision: precision / length,
		marksGained: marksGained / length,
		marksLost: marksLost / length,
		totalQuestions: toInteger(totalQuestions / length),
	};
};
