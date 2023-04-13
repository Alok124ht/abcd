import { Document, Model, model, Schema, Types } from 'mongoose';
import { IUser } from '../../user/IUser';

const { ObjectId } = Schema.Types;

interface VideoCommentBase {
	text: string;
	createdAt: Date;
	updatedAt: Date;
}

interface VideoComment extends Document, VideoCommentBase {
	video: Types.ObjectId;
	user: Types.ObjectId;
}

export interface VideoCommentUserPopulated extends VideoCommentBase, Document {
	user: IUser;
	video: Types.ObjectId;
}

interface VideoCommentModelInterface extends Model<VideoComment> {}

const VideoCommentSchema = new Schema(
	{
		video: {
			type: ObjectId,
			ref: 'Video',
			required: true,
		},
		text: {
			type: String,
			required: true,
		},
		user: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true }
);

const VideoCommentModel = model<VideoComment, VideoCommentModelInterface>(
	'VideoComment',
	VideoCommentSchema
);

export default VideoCommentModel;
