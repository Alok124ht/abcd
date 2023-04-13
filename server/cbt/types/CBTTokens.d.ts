import { Document } from 'mongoose';
import { Client } from 'server/types/Client';

export interface ICBTTokens extends Document {
	token: string;
	client: Client;
	active: boolean;
}
