import { Document, Types } from 'mongoose';
import { Client } from './Client';

export interface IBatch extends Document {
	name: string;
	client: Client | Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}
