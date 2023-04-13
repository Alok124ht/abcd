import { Schema, Types, model, Document, Model } from 'mongoose';
import { State } from './GeoState';

const DistrictSchema = new Schema(
	{
		name: { type: String, required: true },
		state: { type: Schema.Types.ObjectId, ref: 'GeoState', required: true },
		districtId: { type: Number, required: true, unique: true },
	},
	{ timestamps: true }
);

export interface DistrictBase {
	name: string;
	state: Types.ObjectId | State;
	districtId: number;
}

export interface District extends Document, DistrictBase {}

interface DistrictModel extends Model<District> {}

export default model<District, DistrictModel>('GeoDistrict', DistrictSchema);
