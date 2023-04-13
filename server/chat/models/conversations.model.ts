import { model, Schema } from 'mongoose';
import { IConversation } from '../types/conversations';

const schema = new Schema(
	{
		users: {
			required: true,
			type: [
				{
					user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
					isAdmin: { type: Boolean, required: true, default: false },
				},
			],
		},
		isGroup: { type: Boolean, required: true, default: false },
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		name: String,
		description: String,
		image: String,
		removedMembers: [
			{
				user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
				isAdmin: { type: Boolean, required: true, default: false },
			},
		],
		isArchived: { type: Boolean, default: false },
		temporaryDeletedFor: [
			{ type: Schema.Types.ObjectId, ref: 'User', required: true },
		],
		adminOnly: { type: Boolean, default: false },
	},
	{
		timestamps: true,
	}
);

const ConversationModel = model<IConversation>('Conversations', schema);

export = ConversationModel;
