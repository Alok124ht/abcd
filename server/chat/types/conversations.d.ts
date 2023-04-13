import { Document } from 'mongoose';
import { IUser } from '../../user/IUser';

interface UserInConversation extends Document {
	user: IUser;
	isAdmin: boolean;
}

export interface IConversation extends Document {
	users: UserInConversation[];
	isGroup: boolean;
	createdBy: IUser;
	name?: string;
	description?: string;
	image?: string;
	removedMembers: UserInConversation[];
	isArchived: boolean;
	temporaryDeletedFor: IUser[];
	adminOnly: boolean;
}
