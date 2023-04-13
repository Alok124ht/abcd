import { Document, Model, Types } from 'mongoose';
import { IUser } from '../user/IUser';
import { IServicePlan } from './ServicePlan';

interface OfferBase {
	startTime: Date;
	endTime: Date;
	items: { value: Types.ObjectId | IServicePlan; itemModel: 'ServicePlan' };
	validations: {
		type: string;
		value: any;
	};
	usageLimit: number;
	timesUsed: number;
	discount: Discount;
	createdBy: Types.ObjectId | IUser;
	createdAt: Date;
	updatedAt: Date;
}

export interface IOffer extends OfferBase, Document {
	isValid: (item: string | Document) => Promise<void>;
}

export interface OfferModel extends Model<IOffer> {}
