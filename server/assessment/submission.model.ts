import { Schema, Types, model } from 'mongoose';
import { ISubmission, SubmissionModel } from '../types/Submission';

const { ObjectId } = Schema.Types;
const SubmissionSchema = new Schema(
	{
		assessment: {
			type: ObjectId,
			ref: 'Assessment',
		},
		assessmentWrapper: {
			type: ObjectId,
			ref: 'AssessmentWrapper',
			index: true,
		},
		assessmentCore: {
			type: ObjectId,
			ref: 'AssessmentCore',
			index: true,
		},
		wrapperAnalysis: {
			type: ObjectId,
			ref: 'WrapperAnalysis',
		},
		coreAnalysis: {
			type: ObjectId,
			ref: 'CoreAnalysis',
		},
		user: {
			type: ObjectId,
			ref: 'User',
		},
		response: {
			type: Object,
		},
		originalResponse: {
			type: Object,
		},
		flow: {
			type: Array,
			default: [],
		},
		// meta is to store all the extra info like marks and all
		meta: {
			// define structure!!
			type: Object,
		},
		graded: {
			type: Boolean,
			default: false,
			index: true,
		},
		recommendations: {
			type: Object,
			default: {},
		},
		roadmap: {
			type: Object,
			default: {},
		},
		live: {
			type: Boolean,
			default: true,
		},
		isCategorized: {
			type: Boolean,
			default: true,
		},
		messages: [
			{
				type: {
					type: String,
				},
				message: String,
			},
		],
		version: {
			type: Number,
			default: 1,
		},
		attemptsUpdated: {
			type: Boolean,
			default: false,
			index: true,
		},
		ignore: {
			type: Boolean,
			default: false,
			index: true,
		},
		sEvent: {
			type: String,
			default: '',
		},
		submittedBy: {
			type: ObjectId,
			ref: 'User',
		},
	},
	{ timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

SubmissionSchema.statics = {
	getAllGraded(
		this: SubmissionModel,
		id: string | Types.ObjectId,
		populate: any
	) {
		console.log(id, populate);
		if (populate) {
			return this.find({ assessmentCore: id, graded: true })
				.populate(populate)
				.exec();
		}
		return this.find({ assessmentCore: id, graded: true }).exec();
	},

	getAllGraded2(this: SubmissionModel, ids: (string | Types.ObjectId)[]) {
		return this.find({
			_id: { $in: ids },
		})
			.populate([{ path: 'user' }])
			.exec();
	},
};

export default model<ISubmission, SubmissionModel>(
	'Submission',
	SubmissionSchema
);
