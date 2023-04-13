import { Schema, model } from 'mongoose';
import { VideoDocument, VideoModelInterface } from '../../types/Video';
import { canShowContent } from './utils';

const { ObjectId } = Schema.Types;

const VideoSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		guid: String,
		streamKey: String,
		thumbNailsUrls: [
			{
				type: String,
			},
		],
		endpoints: {
			CMAF: String,
			DASH: String,
			HLS: String,
			MSS: String,
		},
		isEmbeded: {
			type: Boolean,
		},
		embedUrlId: {
			type: String,
		},
		embedType: {
			type: String,
			enum: ['Youtube', 'vimeo'],
		},
		duration: Number,
		type: {
			type: String,
			enum: ['Live', 'Video'],
			default: 'Video',
		},
		liveUrl: {
			type: String,
		},
		liveFrom: {
			type: Date,
		},
		liveTill: {
			type: Date,
		},
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		tags: [
			{
				key: String,
				value: String,
			},
		],
		isArchived: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

VideoSchema.method(
	'makeForPublic',
	function makeForPublic(
		this: VideoDocument,
		{
			withEndpoints = false,
			hasAccessToContent,
		}: {
			withEndpoints: boolean;
			hasAccessToContent: boolean;
		}
	) {
		const showContent = canShowContent(hasAccessToContent, this.tags);
		return {
			_id: this._id,
			title: this.title,
			description: this.description,
			thumbNailsUrls: this.thumbNailsUrls,
			endpoints: withEndpoints && showContent ? this.endpoints : undefined,
			isEmbeded: this.isEmbeded,
			embedType: this.embedType,
			embedUrlId: withEndpoints && showContent ? this.embedUrlId : undefined,
			type: this.type,
			liveFrom: this.liveFrom,
			liveTill: this.liveTill,
			liveUrl: withEndpoints && showContent ? this.liveUrl : undefined,
			tags: this.tags,
			createdBy: this.createdBy,
		};
	}
);

export default model<VideoDocument, VideoModelInterface>('Video', VideoSchema);
