import { Document } from 'mongoose';

interface IClientToken extends Document {
	client: string;
	token: string;
	active: boolean;
}
