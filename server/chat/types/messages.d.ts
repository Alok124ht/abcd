import { IUser } from '../../user/IUser';
import { IConversation } from './conversations';
import { IMessageMedia } from './messagesmedia';

export interface IMessage {
	sender: IUser;
	isArchived: boolean;
	text: string;
	media?: IMessageMedia[];
	deletedFor: IUser[];
	conversation: IConversation;
	readBy: IUser[];
}
