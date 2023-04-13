import { Document, Schema, model, Model, Types } from 'mongoose';

interface PhaseMentorDocument extends Document {
	phase: Types.ObjectId;
	user: Types.ObjectId;
	subject: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

interface PhaseMentorModelInterface extends Model<PhaseMentorDocument> {}

const PhaseMentorSchema = new Schema(
	{
		phase: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Phase',
		},
		user: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		subject: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Subject',
		},
	},
	{
		timestamps: true,
	}
);

PhaseMentorSchema.index({ phase: 1, subject: 1, user: 1 }, { unique: true });

const PhaseMentorModel = model<PhaseMentorDocument, PhaseMentorModelInterface>(
	'PhaseMentor',
	PhaseMentorSchema
);

export default PhaseMentorModel;
