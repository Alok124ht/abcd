import { Document } from 'mongoose';
import { IUser } from '../../user/IUser';
import { Client } from '../../types/Client';
import { IInventoryProducts } from './InventoryProducts';

interface ProductAddedBy {
	user: IUser;
	date: Date;
}

interface IInventoryStock extends Document {
	client: Client;
	quantity: number;
	product: IInventoryProducts;
	addedBy: ProductAddedBy[];
}

export = IInventoryStock;
