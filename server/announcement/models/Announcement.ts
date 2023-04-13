import { Schema, model } from 'mongoose';
import mongooseDelete from 'mongoose-delete';
import {
	AnnouncementDocument,
	AnnouncementModelInterface,
} from '../../types/Announcement';

const { ObjectId } = Schema.Types;

const AnnouncementSchema = new Schema(
	{
		visibleTo: [
			{ type: { type: String, enum: ['Phase'] }, value: { type: ObjectId } },
		],
		title: { type: String },
		body: { type: String },
		files: [
			{
				name: String,
				extension: String,
				type: { type: String },
				url: { type: String },
			},
		],
		categories: [{ type: String }],
		createdBy: { type: ObjectId, ref: 'User', required: true },
		isArchived: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

AnnouncementSchema.plugin(mongooseDelete);

const AnnouncementModel = model<
	AnnouncementDocument,
	AnnouncementModelInterface
>('Announcement', AnnouncementSchema);

export default AnnouncementModel;
