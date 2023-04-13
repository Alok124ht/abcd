import { Schema, Types, model, Document, Model } from 'mongoose';

const DistrictSearchLogSchema = new Schema(
	{
		count: { type: Number, default: 0, required: true },
		district: { type: Schema.Types.ObjectId, required: true },
	},
	{ timestamps: true }
);

export interface DistrictSearchLogBase {
	count: number;
	district: Types.ObjectId;
	createdAt?: Date;
	updatedAt?: Date;
}

export interface DistrictSearchLogDocument
	extends Document,
		DistrictSearchLogBase {}

interface DistrictSearchLogModel extends Model<DistrictSearchLogDocument> {}

export default model<DistrictSearchLogDocument, DistrictSearchLogModel>(
	'VaccineDistrictSearchLog',
	DistrictSearchLogSchema
);
