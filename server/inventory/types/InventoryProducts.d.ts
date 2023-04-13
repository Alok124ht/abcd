import { Document } from 'mongoose';
import { IUser } from '../../user/IUser';
import { Client } from '../../types/Client';
import { IInventoryBrand } from './InventoryBrand';

interface OldPrices {
	price: number;
	effectiveTill: Date;
}

interface IInventoryProducts extends Document {
	name: string;
	description?: string;
	price: number; // in paisaaa
	oldPrices: OldPrices[];
	client: Client;
	qrcode: string;
	createdBy: IUser;
	isArchived: boolean;
	brand: IInventoryBrand;
	image: string;
}
