import { Model, Document } from 'mongoose';
import {
	ResourceBase,
	ResourceBaseDocument,
} from '../learningCenter/models/ResourceBaseSchema';

interface VideoBase extends ResourceBase {
	endpoints?: {
		HLS: string;
	};
	isEmbeded: boolean;
	embedUrlId: string;
	embedType: 'Youtube' | 'vimeo';
	duration: number;
	streamKey: string;
	type: 'Live' | 'Video';
	liveUrl: string;
	liveFrom: Date;
	liveTill: Date;
}

interface VideoDocument extends Document, VideoBase, ResourceBaseDocument {}

interface VideoModelInterface extends Model<VideoDocument> {}
