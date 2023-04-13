import { model, Schema } from 'mongoose';

const {
	Types: { ObjectId },
} = Schema;

const schema = new Schema(
	{
		name: { type: String, required: true },
		description: String,
		image: String,
		availableFrom: Date,
		availableTo: Date,
		availabilitySet: Boolean,
		isArchived: Boolean,
		createdBy: { type: ObjectId, ref: 'User', required: true },
		price: Number,
		isCourseFree: Boolean,
		availableForAll: Boolean,
		visibleInPhases: [{ type: ObjectId, ref: 'Phase' }],
		subject: [{ type: ObjectId, ref: 'Subject' }],
		hiddenFor: [{ type: ObjectId, ref: 'User' }],
		onlyShowTo: [{ type: ObjectId, ref: 'User' }],
		client: { type: ObjectId, ref: 'User' },
	},
	{ timestamps: true }
);

const CourseModel = model<any>('Courses', schema);

export = CourseModel;
