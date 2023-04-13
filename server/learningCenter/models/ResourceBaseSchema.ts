import { Document, Types, Schema, Model } from 'mongoose';
import { TagList } from '../../types/Tag';

const { ObjectId } = Schema.Types;

const ResourceBaseSchema = {
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
};

export interface ResourceBase {
	title: string;
	description: string;
	thumbNailsUrls: string[];
	createdBy: Types.ObjectId;
	tags: TagList;
}

export interface ResourceBaseDocument extends Document, ResourceBase {
	makeForPublic(options: {
		withEndpoints: boolean;
		hasAccessToContent: boolean;
	}): any;
}

export interface ResourceBaseStatics {}

export default ResourceBaseSchema;
