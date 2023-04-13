import { Schema, model, Model } from 'mongoose';
import { canShowContent } from './utils';
import ResourceBaseSchema, {
	ResourceBase,
	ResourceBaseDocument,
} from './ResourceBaseSchema';

interface ResourceDocumentBase extends ResourceBase {
	endpoints: string[];
	type: 'document' | 'book';
}

interface ResourceDocument extends ResourceBaseDocument, ResourceDocumentBase {}

const ResourceDocumentSchema = new Schema(
	{
		...ResourceBaseSchema,
		endpoints: [{ type: String }],
		type: { type: String, default: 'document' },
	},
	{ timestamps: true }
);

ResourceDocumentSchema.method(
	'makeForPublic',
	function makeForPublic(
		this: ResourceDocument,
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
			endpoints: withEndpoints && showContent ? this.endpoints : undefined,
			_id: this._id,
			title: this.title,
			description: this.description,
			thumbNailsUrls: this.thumbNailsUrls,
			tags: this.tags,
			createdBy: this.createdBy,
		};
	}
);

interface ResourceDocumentModel extends Model<ResourceDocument> {}

export default model<ResourceDocument, ResourceDocumentModel>(
	'ResourceDocument',
	ResourceDocumentSchema
);
