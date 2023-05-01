import { model, Schema } from 'mongoose';
import { IMessageMedia } from '../types/messagesmedia';

const schema = new Schema(
	{
		url: { type: String, required: true },
		message: { type: Schema.Types.ObjectId, required: true, ref: 'Messages' },
		mediaType: {
			type: String,
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

const MessageMediaModel = model<IMessageMedia>('MessageMedias', schema);

export = MessageMediaModel;
