import { Document, Model, Schema, Types, model } from 'mongoose';

interface GroupBase {
	numberOfMessages: number;
	lastConversationReadTimestamp: {
		[key: string]: Date;
	};
	createdAt: Date;
	updatedAt: Date;
}

export interface GroupDocument extends Document, GroupBase {
	lastMessage: Types.ObjectId;
	members: Types.ObjectId[];
}

interface GroupModelInterface extends Model<GroupDocument> {}

const Group = new Schema(
	{
		members: [
			{
				type: Schema.Types.ObjectId,
				ref: 'User',
			},
		],
		lastMessage: {
			type: Schema.Types.ObjectId,
			ref: 'MentorshipMessage',
		},
		lastConversationReadTimestamp: {
			type: Schema.Types.Mixed,
			default: {},
		},
		numberOfMessages: {
			type: Number,
			default: 0,
		},
	},

	{ timestamps: true, strict: false }
);

const GroupModel = model<GroupDocument, GroupModelInterface>(
	'MentorshipGroup',
	Group
);

export default GroupModel;
