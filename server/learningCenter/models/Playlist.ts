import { Schema, model } from 'mongoose';
import { filter } from 'lodash';
import {
	MakePlaylistForPublicOptions,
	MakePlaylistForPublicReturn,
	Playlist,
	PlaylistModelInterface,
} from '../../types/Playlist';

const { ObjectId } = Schema.Types;

const PlaylistSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		thumbNailsUrls: [
			{
				type: String,
			},
		],
		items: [{ type: ObjectId, ref: 'PlaylistItem' }],
		tags: [
			{
				key: String,
				value: String,
			},
		],
		createdBy: {
			type: ObjectId,
			ref: 'User',
			required: true,
		},
		serviceMachineNamesRequired: {
			type: Boolean,
			default: false,
		},
		serviceMachineNames: [
			{
				/**
				 * One of the service name from ServiceModel.machineName
				 */
				type: String,
			},
		],
		subject: {
			type: ObjectId,
			ref: 'Subject',
		},
		accessibleTo: [
			{
				value: {
					type: ObjectId,
					refPath: 'accessibleTo.type',
				},
				type: {
					type: String,
					enum: ['Phase', 'UserGroup', 'User'],
				},
			},
		],
		permissions: [
			{
				item: {
					type: ObjectId,
					refPath: 'permissions.itemType',
				},
				itemType: {
					type: String,
					// item type is model name
					enum: ['UserGroup', 'User'],
				},
			},
		],
		resourceType: {
			type: String,
			default: 'Video',
			enum: ['Video', 'ResourceDocument', 'Assignment', 'Book'],
		},
		setting: {
			type: ObjectId,
			ref: 'PlaylistSetting',
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true }
);

PlaylistSchema.method(
	'makeForPublic',
	function makeForPublic(
		options: MakePlaylistForPublicOptions
	): MakePlaylistForPublicReturn {
		const hasAccessToContent = options && options.hasAccessToContent;
		const items = filter(this.items, (item) => item.isValid()).map((item) =>
			item.makeForPublic(options)
		);
		return {
			title: this.title,
			thumbNailsUrls: this.thumbNailsUrls,
			_id: this._id,
			items,
			setting: this.setting,
			tags: this.tags,
			resourceType: this.resourceType,
			hasAccessToContent,
			serviceMachineNamesRequired: this.serviceMachineNamesRequired,
			serviceMachineNames: this.serviceMachineNames,
			subject: this.subject,
			createdBy: this.createdBy,
		};
	}
);

const PlaylistModel = model<Playlist, PlaylistModelInterface>(
	'Playlist',
	PlaylistSchema
);
export default PlaylistModel;
