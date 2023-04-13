import { IUser } from '../user/IUser';
import { Document } from 'mongoose';
import { Client } from './Client';
import { Types } from 'mongoose';

declare enum LeaveTypes {
	CASUAL = 'casual',
	MEDICAL = 'medical',
	UNPAID = 'unpaid',
}

export interface LeavesStatus {
	date: Date;
	granted: boolean;
	rejected: boolean;
	actedBy: IUser | string | Types.ObjectId;
	actedOn: Date;
	fullDay: boolean;
	type: LeaveTypes;
}

interface ILeaves extends Document {
	user: IUser | string | Types.ObjectId;
	client: Client;
	fromDate: Date;
	toDate: Date;
	description: string;
	days: number;
	leavesStatus: LeavesStatus[];
	createdBy: IUser | string | Types.ObjectId;
}

export { ILeaves };
