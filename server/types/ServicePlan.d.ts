import { Document, Model, Types } from 'mongoose';
import { SoftDeleteDocument, SoftDeleteModel } from 'mongoose-delete';
import { IUser } from '../user/IUser';
import { Merchant } from './Merchant';
import { IOffer } from './Offer';
import { Tag } from './Tag';

interface ServicePlanBase {
	name: string;
	description: string;
	basePrice: number;
	currency: 'INR';
	duration: number;
	thumbNailUrl: string;
	disableTransfers: boolean;
	visibleIn: { type: 'Phase'; value: Types.ObjectId | string | Document }[];

	merchant: Types.ObjectId | Merchant;

	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date;

	createdBy: Types.ObjectId | IUser;
	updatedBy: Types.ObjectId | IUser;

	services: Types.ObjectId[];
	tags: Tag[];
}

interface RazorpayTransfer {
	account: string;
	currency: 'INR';
	amount: number;
}

export interface IServicePlan
	extends ServicePlanBase,
		Document,
		SoftDeleteDocument {
	getTransfers: (
		this: IServicePlan,
		amount: number,
		currency: 'INR'
	) => Promise<RazorpayTransfer[]>;
	getOffers: (this: IServicePlan) => Promise<IOffer[]>;
}

export interface ServicePlanModel extends SoftDeleteModel<IServicePlan> {}
