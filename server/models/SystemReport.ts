import { ObjectId } from 'mongodb';
import { Document, model, Model, Schema, Types } from 'mongoose';

interface SystemReport extends Document {
	/**
	 * type of report
	 */
	type: string;
	/**
	 * Brief message
	 */
	message: string;
	/**
	 * Descriptive message
	 */
	description?: string;
	/**
	 * If it happed with specific user
	 */
	user?: Types.ObjectId;
	/**
	 * Authentication Token, if any
	 */
	token: string;
	createdAt: Date;
	updatedAt: Date;
}
interface SystemReportModelInterface extends Model<SystemReport> {}

const SystemReportSchema = new Schema(
	{
		type: {
			type: String,
		},
		message: {
			type: String,
		},
		description: {
			type: String,
		},
		user: {
			type: ObjectId,
		},
		token: {
			type: String,
		},
	},
	{ timestamps: true }
);

const SystemReportModel = model<SystemReport, SystemReportModelInterface>(
	'SystemReport',
	SystemReportSchema
);

export default SystemReportModel;
