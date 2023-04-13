import { Schema, model } from 'mongoose';
import {
	MakePlaylistItemForPublicOptions,
	MakePlaylistItemForPublicReturn,
	PlaylistItem,
	PlaylistItemModelInterface,
} from '../../types/PlaylistItem';
import { getAvailableFrom, getAvailableTill } from '../utils/availability';

const { Mixed, ObjectId } = Schema.Types;

const PlaylistItemSchema = new Schema(
	{
		availableFrom: {
			type: Date,
			default: Date.now,
		},
		availableTill: {
			type: Date,
		},
		availableFromByPhase: {
			type: Mixed,
		},
		availableTillByPhase: {
			type: Mixed,
		},
		video: { type: ObjectId, ref: 'Video' },
		resource: {
			type: ObjectId,
			refPath: 'resourceModel',
		},
		resourceModel: {
			type: String,
			enum: ['Video', 'ResourceDocument', 'Assignment'],
			default: 'Video',
		},
		tags: [
			{
				key: { type: String, required: true },
				value: {
					type: String,
					required: true,
				},
			},
		],
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
	},
	{ timestamps: true }
);

PlaylistItemSchema.method(
	'makeForPublic',
	function makeForPublic(
		options: MakePlaylistItemForPublicOptions
	): MakePlaylistItemForPublicReturn {
		const hasAccessToContent = options && options.hasAccessToContent;
		const now = Date.now();
		const { phases } = options;
		const availableFrom = getAvailableFrom(this, phases);
		const availableTill = getAvailableTill(this, phases);
		const withEndpoints =
			availableFrom.getTime() <= now &&
			(!availableTill || availableTill.getTime() >= now);
		return {
			_id: this._id,
			availableFrom,
			availableTill,
			tags: this.tags,
			resourceModel: this.resourceModel,
			hasAccess: hasAccessToContent,
			resource: this.resource.makeForPublic
				? this.resource.makeForPublic({ withEndpoints, hasAccessToContent })
				: this.resource,
			phases,
			availableFromByPhase: this.availableFromByPhase,
		};
	}
);

PlaylistItemSchema.method('isValid', function isValid() {
	if (this.resource) {
		return true;
	}
	return false;
});

const PlaylistItemModel = model<PlaylistItem, PlaylistItemModelInterface>(
	'PlaylistItem',
	PlaylistItemSchema
);

export default PlaylistItemModel;
