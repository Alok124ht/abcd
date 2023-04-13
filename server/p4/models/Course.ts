import { model, Schema } from 'mongoose';
import { Course, CourseModelInterface } from '../types/Course';

const actionHookConfigSchema = {
	phase: Schema.Types.ObjectId,
	subGroup: Schema.Types.ObjectId,
	superGroup: Schema.Types.ObjectId,
	wrapper: Schema.Types.ObjectId,
	email: {
		subject: String,
		mainMessage: String,
	},
};

const CourseSchema = new Schema(
	{
		title: { type: String, required: true },
		price: {
			// this is offer price
			// price in paisa not rupee
			type: Number,
			required: true,
		},
		originalPrice: {
			type: Number,
		},
		config: {
			requireGrades: Boolean,
			onApplication: actionHookConfigSchema,
			onPurchase: actionHookConfigSchema,
		},
		currency: {
			type: String,
			default: 'INR',
			enum: ['INR'],
			required: true,
		},
		type: {
			type: String,
			default: 'course',
			enum: ['course', 'combo'],
		},
		courses: [
			{
				type: Schema.Types.ObjectId,
				ref: 'P4Course',
			},
		],
		tags: [
			{
				key: String,
				value: String,
			},
		],
		phase: {
			type: Schema.Types.ObjectId,
			ref: 'Phase',
		},
	},
	{
		timestamps: true,
	}
);

const CourseModel = model<Course, CourseModelInterface>(
	'P4Course',
	CourseSchema
);
export default CourseModel;
