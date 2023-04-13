import { Schema, Types, model, Document, Model } from 'mongoose';
import moment, { Moment } from 'moment';
import { District } from './GeoDistrict';
import { dateFormat } from '../constants';

const VaccineInDistrictOnDateSchema = new Schema(
	{
		district: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'GeoDistrict',
			index: true,
		},
		date: { type: Date, required: true, index: true },
		lastRefreshedAt: { type: Date, required: true, index: true },
		refreshStartedAt: { type: Date, required: true },
		isRefreshing: { type: Date, required: false },
	},
	{ timestamps: true }
);

VaccineInDistrictOnDateSchema.index({ district: 1, date: 1 }, { unique: true });

VaccineInDistrictOnDateSchema.method(
	'getKey',
	function getKey(this: VaccineInDistrictOnDateDocument) {
		return this.district.toString() + moment(this.date).format(dateFormat);
	}
);

VaccineInDistrictOnDateSchema.static(
	'getKey',
	function (item: {
		district: string | Types.ObjectId;
		date: Moment | Date;
	}): string {
		return item.district.toString() + moment(item.date).format(dateFormat);
	}
);

export interface VaccineInDistrictOnDateBase {
	district: Types.ObjectId | District;
	date: Date;
	lastRefreshedAt: Date;
	refreshStartedAt: Date;
	isRefreshing: boolean;
}

export interface VaccineInDistrictOnDateDocument
	extends Document,
		VaccineInDistrictOnDateBase {
	getKey: (this: VaccineInDistrictOnDateDocument) => string;
}

interface VaccineInDistrictOnDateModelInternal
	extends Model<VaccineInDistrictOnDateDocument> {
	getKey: (item: {
		district: string | Types.ObjectId;
		date: Moment | Date;
	}) => string;
}

const VaccineInDistrictOnDateModel = model<
	VaccineInDistrictOnDateDocument,
	VaccineInDistrictOnDateModelInternal
>('VaccineInDistrictOnDate', VaccineInDistrictOnDateSchema);

export default VaccineInDistrictOnDateModel;
