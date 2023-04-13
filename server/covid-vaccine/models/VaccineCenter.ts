import { Schema, model, Model, Document, Types } from 'mongoose';
import { District } from './GeoDistrict';

const VaccineCenterSchema = new Schema(
	{
		centerId: {
			type: Number,
			index: true,
		},
		feeType: String,
		blockName: String,
		pinCode: Number,
		name: String,
		district: {
			type: Schema.Types.ObjectId,
			ref: 'GeoDistrict',
			index: true,
		},
	},
	{ timestamps: true }
);

export interface VaccineCenterBase {
	centerId: number;
	feeType: string;
	blockName: string;
	pinCode: number;
	name: string;
	district: Types.ObjectId | District;
}

export interface VaccineCenter extends Document, VaccineCenterBase {
	createdAt: Date;
	updatedAt: Date;
}

interface VaccineCenterModel extends Model<VaccineCenter> {}

export default model<VaccineCenter, VaccineCenterModel>(
	'VaccineCenter',
	VaccineCenterSchema
);
