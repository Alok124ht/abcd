import { Schema, Types, model } from 'mongoose';
import { Attempt, AttemptModel } from '../types/Attempt';
import { batch } from '../constants';
import QuestionStatistics from '../question/QuestionStatistics.model';

const { ObjectId, Mixed } = Schema.Types;

const answerSchema = {
	type: {
		type: String,
		enum: ['option', 'options', 'number'],
	},
	data: Mixed,
};

const AttemptSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		question: {
			type: ObjectId,
			ref: 'Question',
			required: true,
			index: true,
		},
		mode: {
			type: String,
			default: 'practice',
		},
		reference: {
			type: ObjectId,
			refPath: 'onModel',
		},
		onModel: {
			type: String,
			enum: ['AssessmentWrapper', 'Session'],
		},
		batch: {
			type: Number,
			default: batch,
		},
		answer: answerSchema,
		isAnswered: {
			type: Boolean,
			default: false,
		},
		isCorrect: Boolean,
		startTime: {
			type: Date,
		},
		endTime: {
			type: Date,
		},
		flow: [{ startTime: Date, endTime: Date }],
		answerSelectionFlow: [
			Object.assign(
				{
					createdAt: {
						type: Date,
						default: Date.now,
					},
				},
				answerSchema
			),
		],
		isSkipped: {
			type: Boolean,
		},
		time: {
			type: Number,
			default: 0,
		},
		speed: {
			type: Number,
			enum: [0, 5, 10],
		},
		isBookmarked: {
			type: Boolean,
		},
		xpEarned: {
			type: Number,
			default: 0,
		},
		perfectTimeLimits: {
			min: Number,
			max: Number,
		},
		medianTime: { type: Number },
		demoRank: {
			type: Number,
		},
		version: {
			type: Number,
			enum: [1, 2],
			default: 1,
		},
	},
	{
		timestamps: true,
		autoIndex: false,
	}
);

AttemptSchema.post('save', (doc: Attempt) => {
	try {
		if (doc.isAnswered && doc.answer && doc.answer.type === 'option') {
			doc.populate(
				{ path: 'question', select: 'options.votes options._id' },
				(err, attempt: Attempt) => {
					attempt.question.options.forEach((option, index) => {
						if (option._id.equals(doc.answer.data)) {
							attempt.question.options[index].votes += 1;
							if (Number.isNaN(attempt.question.options[index].votes)) {
								attempt.question.options[index].votes = 1;
							}
						}
					});
					attempt.question.save();
				}
			);
		}
	} catch (e) {
		console.error('error in post save of attempt schema');
		console.error(e);
	}
});

AttemptSchema.static(
	'addAttempt',
	function addAttempt(
		this: AttemptModel,
		userId: Types.ObjectId,
		question: { question: Types.ObjectId; startTime: Date }
	): Promise<Attempt> {
		return new Promise((resolve, reject) => {
			QuestionStatistics.findByQuestionId(question.question).then(
				(questionStatistics) => {
					const startTime = question.startTime ? question.startTime : Date.now();
					const attempt = new this({
						user: userId,
						question: question.question,
						startTime,
						endTime: null,
						speed: null,
						isCorrect: null,
						isAnswered: false,
						answer: null,
						xpEarned: 0,
						perfectTimeLimits: questionStatistics.perfectTimeLimits,
						medianTime: questionStatistics.medianTime,
						demoRank: questionStatistics.demoRank,
						flow: [{ startTime }],
					});

					return attempt.save((error) => {
						if (error) {
							reject(error);
						} else {
							resolve(attempt);
						}
						questionStatistics.attempts.push(attempt._id);
						questionStatistics.save();
					});
				}
			);
		});
	}
);

export default model<Attempt, AttemptModel>('Attempt', AttemptSchema);
