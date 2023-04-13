import { model, Document, Schema, Types } from 'mongoose';

interface BucketItem {
	name: string;
	color: string;
	default: boolean;
	questions: Types.ObjectId[];
}

export interface IBookmarkedAtByQuestionId {
	[questioId: string]: Date;
}

interface BucketDocument extends Document {
	user: string;
	buckets: Array<BucketItem>;
	bookmarkedAtByQuestionId: IBookmarkedAtByQuestionId;
}

const ObjectId = Schema.Types.ObjectId;
const BucketSchema = new Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			unique: true,
			index: true,
		},
		buckets: [
			{
				name: {
					type: String,
					default: 'Question Bucket',
				},
				color: {
					type: String,
					default: 'blue',
				},
				default: {
					type: Boolean,
					default: false,
				},
				questions: [
					{
						type: ObjectId,
						ref: 'Question',
					},
				],
			},
		],
		bookmarkedAtByQuestionId: { type: Object, default: {} },
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

export default model<BucketDocument>('Bucket', BucketSchema);
