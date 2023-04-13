import { Document } from 'mongoose';
import { IUser } from '../user/IUser';
import { Phase } from '../types/Phase';

interface IFees extends Document {
	standerd: string;
	division: string;
	phase: Phase;
	amount: number;
	paidVia: number;
	user: IUser;
	date: Date;
	addedBy: IUser;
	checkNo: string;
	bank: string;
	upiId: string;
	transactionId: string;
	referenceId: string;
	feeType: string;
	policy: string;
}

export = IFees;
