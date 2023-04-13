import { Document, Types, Schema, model, Model } from 'mongoose';

interface GradeTime extends Document {
	wrapper: Types.ObjectId;
	time: Date;
	graded: boolean;
	createdAt: Date;
	updatedat: Date;
}
interface GradeTimeModelInterface extends Model<GradeTime> {}

const GradeTimeSchema = new Schema(
	{
		wrapper: {
			type: Schema.Types.ObjectId,
			ref: 'AssessmentWrapper',
			unique: true,
		},
		time: {
			type: Date,
		},
		graded: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

const GradeTimeModel = model<GradeTime, GradeTimeModelInterface>(
	'GradeTime',
	GradeTimeSchema
);

export default GradeTimeModel;
