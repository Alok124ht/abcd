import { Schema, model } from 'mongoose';

const TypeSchema = new Schema(
	{
		identifier: {
			type: String,
			require: true,
		},
		label: {
			type: String,
			required: true,
		},
		basePrice: {
			type: Number,
			required: true,
		},
		currency: {
			type: String,
			enum: ['INR'],
			default: 'INR',
			required: true,
		},
		available: {
			type: Boolean,
			default: false,
			required: true,
		},
		inputs: [],
		filters: {
			keywords: [String],
		},
		description: String,
	},
	{ timestamps: true }
);

export default model('MentorshipType', TypeSchema);
