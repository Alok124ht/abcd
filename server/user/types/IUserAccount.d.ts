import { Document, Model, Types } from 'mongoose';

interface UserAccount {
	email: string;
	emailIdentifier: string;
	hash: string;
	salt: string;
}

interface UserAccountBaseDocument extends UserAccount, Document {
	validatePassword(this: UserAccountDocument, password: string): boolean;
	setPassword(this: UserAccountDocument, password: string): void;
	addUser(
		superGroup: string | Types.ObjectId,
		subGroup: string | Types.ObjectId,
		phase: string | Types.ObjectId
	): Promise<void>;
	createUserForPhase(
		superGroup: Types.ObjectId,
		subGroup: Types.ObjectId,
		phase: Types.ObjectId
	): Promise<void>;
}

export interface UserAccountDocument extends UserAccountBaseDocument {
	defaultUser: Types.ObjectId;
	users: Types.Array<Types.ObjectId>;
}

export interface UserAccountModel extends Model<UserAccountDocument> {}
