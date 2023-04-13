import { Document, Model, model, Schema, Types } from 'mongoose';

export interface ShortLink extends Document {
	url: string;
	type: string;
	key: string;
	description: string;
	visitCount: number;
	createdAt: Date;
	updatedAt: Date;
	createdBy: Types.ObjectId;
}

interface ShortLinkModelInterface extends Model<ShortLink> {}

const ShortLinkSchema = new Schema(
	{
		url: String,
		type: { type: String, index: true },
		key: {
			type: String,
			unique: true,
			index: true,
		},
		description: {
			type: String,
		},
		visitCount: {
			type: Number,
			default: 0,
		},
		createdBy: {
			type: Schema.Types.ObjectId,
			ref: 'User',
			required: true,
			index: true,
		},
	},
	{
		timestamps: true,
	}
);

const ShortLinkModel = model<ShortLink, ShortLinkModelInterface>(
	'ShortLink',
	ShortLinkSchema
);
export default ShortLinkModel;
