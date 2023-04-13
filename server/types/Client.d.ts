import { Document, Model, Types } from 'mongoose';

interface AvailableLeaves {
	casual: number;
	medical: number;
}

interface ClientBase {
	name: string;
	phases: Types.ObjectId[];
	moderators: any[];
	support: { email: string }[];
	razorpayAccounts: Types.ObjectId[];
	merchants: Types.ObjectId[];
	permissions: { id: 'email-management' }[];
	urls: {
		portals: string[];
		websites: string[];
	};
	logo: string;
	jwtSecret: string;
	accessToken?: string;
	createdAt: Date;
	updatedAt: Date;
	portal: string;
	availableLeaves: AvailableLeaves;
	clientType: string;
}

export interface Client extends ClientBase, Document {}

export interface ClientModelInterface extends Model<Client> {}
