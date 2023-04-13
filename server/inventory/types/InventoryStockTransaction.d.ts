import { Document } from 'mongoose';
import { Client } from '../../types/Client';
import { IUser } from '../../user/IUser';
import { IInventoryProducts } from './InventoryProducts';

interface IInventoryStockTransaction extends Document {
	product: IInventoryProducts;
	addedBy: IUser;
	quantity: number;
	client: Client;
}
