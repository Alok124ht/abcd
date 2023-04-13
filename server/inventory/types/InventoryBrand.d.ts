import { Document } from 'mongoose';
import { IUser } from '../../user/IUser';
import { Client } from '../../types/Client';

interface IInventoryBrand extends Document {
	name: string;
	image?: string;
	client: Client;
	createdBy: IUser;
	isArchived: boolean;
}
