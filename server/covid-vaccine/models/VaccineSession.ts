import { Schema, model, Model, Document, Types } from 'mongoose';
import { VaccineCenter } from './VaccineCenter';

const VaccineSessionSchema = new Schema(
	{
		availableCapacity: {
			type: Number,
			index: true,
		},
		minAgeLimit: {
			type: Number,
			index: true,
		},
		slot: [String],
		date: {
			type: Date,
			index: true,
		},
		vaccine: {
			type: String,
			index: true,
		},
		center: {
			type: Schema.Types.ObjectId,
			ref: 'VaccineCenter',
			index: true,
		},
	},
	{ timestamps: true }
);

export interface VaccineSessionBase {
	availableCapacity: number;
	minAgeLimit: number;
	slots: string[];
	date: Date;
	vaccine?: string;
	center: Types.ObjectId | VaccineCenter;
}

export interface VaccineSession extends Document, VaccineSessionBase {}

interface VaccineSessionModel extends Model<VaccineSession> {}

export default model<VaccineSession, VaccineSessionModel>(
	'VaccineSession',
	VaccineSessionSchema
);
