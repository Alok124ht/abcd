import { Document, Schema, model, Model } from 'mongoose';

export interface SubjectDocument extends Document {
	name: string;
	shortName: string;
	/**
	 * Subject color. This will used everywhere with the subject.
	 */
	color: string;
	isColorDark: boolean;
	/**
	 * Preferred text color over subject color
	 */
	textColor: string;
	/**
	 * thumbnail to be used over subject color
	 */
	thumbnail: string;
	topics?: string[];
	createdAt: Date;
	updatedAt: Date;
}

interface SubjectModelInterface extends Model<SubjectDocument> {}

const SubjectSchema = new Schema(
	{
		name: {
			type: String,
			required: true,
			index: true,
			unique: true,
		},
		shortName: {
			type: String,
			required: true,
			index: true,
			unique: true,
		},
		color: {
			type: String,
		},
		isColorDark: {
			type: Boolean,
			default: true,
		},
		textColor: {
			type: String,
		},
		thumbnail: {
			type: String,
		},
		topics: [{ type: String }],
	},
	{
		timestamps: true,
	}
);

const SubjectModel = model<SubjectDocument, SubjectModelInterface>(
	'Subject',
	SubjectSchema
);

export default SubjectModel;
