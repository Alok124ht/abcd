import { Document, Model, Types } from 'mongoose';
import { MakePlaylistForPublicOptions } from './Playlist';
import { TagList } from './Tag';

interface MakePlaylistItemForPublicOptions
	extends MakePlaylistForPublicOptions {}
interface MakePlaylistItemForPublicReturn
	extends Pick<
		PlaylistItem,
		| '_id'
		| 'resource'
		| 'tags'
		| 'resourceModel'
		| 'availableFrom'
		| 'availableTill'
		| 'availableFromByPhase'
	> {
	hasAccess: boolean;
	phases: string[];
}

interface PlaylistItemBase {
	availableFrom: Date;
	availableTill: Date;
	availableFromByPhase: { [phaseId: string]: Date };
	availableTillByPhase: { [phaseId: string]: Date };
	resourceModel: 'Video' | 'ResourceDocument' | 'Assignment';
	tags: TagList;
	createdAt: Date;
	updatedAt: Date;
}

interface PlaylistItem extends Document, PlaylistItemBase {
	video: Types.ObjectId;
	resource: Types.ObjectId;
	createdBy: Types.ObjectId;
	makeForPublic(
		this: PlaylistItem,
		options: MakePlaylistItemForPublicOptions
	): MakePlaylistItemForPublicReturn;
}

interface PlaylistItemModelInterface extends Model<PlaylistItem> {}
