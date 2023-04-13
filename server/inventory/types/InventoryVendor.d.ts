import { Document } from 'mongoose';
import { Client } from '../../types/Client';
import { IUser } from '../../user/IUser';
import { IInventoryBrand } from './InventoryBrand';

interface IVendorAddress {
	line1: string;
	line2: string;
	area: string;
	city: string;
	state: string;
	country: string;
	pincode: string;
}

interface IInventoryVendor extends Document {
	name: string;
	contactNo: string;
	email: string;
	website: string;
	otherMobiles: string[];
	otherEmails: string[];
	socialHandles: { key: string; value: string }[];
	address: IVendorAddress;
	brands: IInventoryBrand[];
	createdBy: IUser;
	client: Client;
	isArchived: boolean;
}

export = IInventoryVendor;
