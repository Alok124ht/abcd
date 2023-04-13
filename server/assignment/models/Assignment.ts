import { Schema, model } from 'mongoose';
import { get, forEach } from 'lodash';
import { AssignmentDocument, AssignmentModel } from '../types/Assignment';
import ResourceBaseSchema from '../../learningCenter/models/ResourceBaseSchema';
import { canShowContent } from '../../learningCenter/models/utils';

const { ObjectId } = Schema.Types;

const AssignmentSchema = new Schema(
	{
		...ResourceBaseSchema,
		files: [
			{
				url: String,
				name: String,
			},
		],
		submissionDeadline: {
			type: Date,
		},
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
		markingScheme: {
			sections: [
				{
					name: String,
					maxMarks: Number,
				},
			],
		},
	},
	{ timestamps: true }
);

AssignmentSchema.method(
	'makeForPublic',
	function makeForPublic(
		this: AssignmentDocument,
		options: { withEndpoints: boolean; hasAccessToContent: boolean }
	) {
		const showContent = canShowContent(options.hasAccessToContent, this.tags);
		return {
			_id: this._id,
			title: this.title,
			description: this.description,
			thumbNailsUrls: this.thumbNailsUrls,
			files: options.withEndpoints && showContent ? this.files : undefined,
			markingScheme: this.markingScheme,
			submissionDeadline: this.submissionDeadline,
			tags: this.tags,
			createdBy: this.createdBy,
		};
	}
);

AssignmentSchema.virtual('maxMarks').get(function getMaxMarks(
	this: AssignmentDocument
) {
	let maxMarks = 0;
	forEach(get(this, ['markingScheme', 'sections']), (section) => {
		maxMarks += section.maxMarks;
	});
	return maxMarks;
});

AssignmentSchema.set('toObject', { virtuals: true });
AssignmentSchema.set('toJSON', { virtuals: true });

export default model<AssignmentDocument, AssignmentModel>(
	'Assignment',
	AssignmentSchema
);
