import { Document, Model, Schema, Types, model } from 'mongoose';
import Group from './Group';

interface MessageBase {
	data: {
		/**
		 * rt -> Rich Text,
		 * text -> Plain Text,
		 * attachment -> Attachment File
		 */
		type: 'text' | 'attachment' | 'rt';
		text: string;
		attachment: Types.ObjectId;
		raw: any;
	};
	createdAt: Date;
	updatedAt: Date;
}

export interface MessageDocument extends MessageBase, Document {
	createdBy: Types.ObjectId;
	group: Types.ObjectId;
}

interface MessageModelInterafce extends Model<MessageDocument> {}

const MessageSchema = new Schema(
	{
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
		},
		group: {
			type: Schema.Types.ObjectId,
			ref: 'MentorshipGroup',
			required: true,
		},
		data: {
			type: {
				type: String,
				enum: ['text', 'attachment', 'rt'],
				// rt is rich text
				required: true,
			},
			text: String,
			attachment: {
				type: Schema.Types.ObjectId,
				ref: 'MentorshipAttachment',
			},
			raw: {},
			// raw is for rich text raw content
		},
	},
	{ timestamps: true }
);

const updateLastMessageOfGroupAndMessageCount = (
	message: MessageDocument,
	numberOfMessages = 1
) => {
	Group.findById(message.group, (error, group) => {
		group.set('lastMessage', message._id);
		group.set('numberOfMessages', group.numberOfMessages + numberOfMessages);
		group.set(
			`lastConversationReadTimestamp.${message.createdBy}`,
			message.createdAt
		);
		group.save();
	});
};

MessageSchema.post('insertMany', (docs: MessageDocument[]) => {
	const lastMessage = docs[docs.length - 1];
	updateLastMessageOfGroupAndMessageCount(lastMessage, docs.length);
});

MessageSchema.post('save', (message: MessageDocument) => {
	updateLastMessageOfGroupAndMessageCount(message, 1);
});

const MessageModel = model<MessageDocument, MessageModelInterafce>(
	'MentorshipMessage',
	MessageSchema
);

export default MessageModel;
