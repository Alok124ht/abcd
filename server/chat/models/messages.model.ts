import { model, Schema } from 'mongoose';
import { IMessage } from '../types/messages';

const schema = new Schema(
	{
		sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
		isArchived: { type: Boolean, default: false },
		text: { type: String, required: true },
		media: [
			{ type: Schema.Types.ObjectId, ref: 'MessageMedias', required: true },
		],
		deletedFor: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
		conversation: {
			type: Schema.Types.ObjectId,
			ref: 'Conversations',
			required: true,
		},
		mediaType: {
			type: String,
			enum: ['image', 'video', 'audio', 'pdf', ''],
			default: '',
		},
		readBy: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
	},
	{
		timestamps: true,
	}
);

const MessagesModel = model<IMessage>('Messages', schema);

export = MessagesModel;
