import { Document, Model, model, Schema, Types } from 'mongoose';

export interface ShortLinkView extends Document {
	shortLink: Types.ObjectId;
	ip: string;
	createdAt: Date;
}

interface ShortLinkViewModelInterface extends Model<ShortLinkView> {}

const ShortLinkViewSchema = new Schema(
	{
		shortLink: {
			type: Schema.Types.ObjectId,
			ref: 'ShortLink',
			required: true,
		},
		ip: String,
	},
	{
		timestamps: { createdAt: true },
	}
);

const ShortLinkViewModel = model<ShortLinkView, ShortLinkViewModelInterface>(
	'ShortLinkView',
	ShortLinkViewSchema
);
export default ShortLinkViewModel;
