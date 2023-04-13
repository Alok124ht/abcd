import { Model, Document, Types } from 'mongoose';
import { ResourceBaseDocument } from 'server/learningCenter/models/ResourceBaseSchema';
import { PlaylistItem } from './PlaylistItem';
import { TagList } from './Tag';

interface MakePlaylistForPublicOptions {
	withEndpoints?: boolean;
	hasAccessToContent: boolean;
	phases: string[];
}

export const enum ResourceType {
	Video = 'Video',
	ResourceDocument = 'ResourceDocument',
	Assignment = 'Assignment',
}

interface PlaylistBase {
	title: string;
	description: string;
	thumbNailsUrls: string[];
	tags: TagList;
	serviceMachineNamesRequired: boolean;
	serviceMachineNames: string[];
	resourceType: ResourceType;
	createdAt: Date;
	updatedAt: Date;
}

type MakePlaylistForPublicReturn = Pick<
	Playlist,
	| 'title'
	| 'subject'
	| 'thumbNailsUrls'
	| '_id'
	| 'items'
	| 'setting'
	| 'tags'
	| 'resourceType'
	| 'serviceMachineNamesRequired'
	| 'serviceMachineNames'
> & { hasAccessToContent: boolean };

interface Playlist extends Document, PlaylistBase {
	// playlist item list
	items: Types.ObjectId[];
	createdBy: Types.ObjectId;
	subject: Types.ObjectId;
	accessibleTo: {
		type: 'User' | 'UserGroup' | 'Phase';
		value: Types.ObjectId;
	}[];
	permissions: {
		item: Types.ObjectId;
		itemType: 'User' | 'UserGroup';
	}[];
	setting: Types.ObjectId;
	makeForPublic(
		this: Playlist,
		options: MakePlaylistForPublicOptions
	): MakePlaylistForPublicReturn;
}

interface PlaylistModelInterface extends Model<Playlist> {}

type PlaylistWithItemPopulated = Omit<Playlist, 'items'> & {
	items: PlaylistItem[];
};

type PlaylistWithItemAndResourcePopulated = Omit<Playlist, 'items'> & {
	items: (Omit<PlaylistItem, 'resource'> & {
		resource: ResourceBaseDocument;
	})[];
};
