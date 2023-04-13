const mongoose = require('mongoose');
const Option = require('./Option');
const ContentSchema = require('./Content.schema');

const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const QuestionSchema = new Schema(
	{
		// MCSC: Multiple Choice Single Correct
		// MCMC: Multiple Choice Multiple Correct
		type: { type: String, enum: ['MCSC', 'MCMC'], required: true },
		paragraph: {
			type: ObjectId,
			ref: 'P4Paragraph',
		},
		options: [{ content: ContentSchema }],
		answer: {
			option: {
				type: Number,
				// ref: 'P4Option',
			},
			options: [{ type: Number }],
		},
		content: ContentSchema,
	},
	{
		timestamps: true,
	}
);

module.exports = mongoose.model('P4Question', QuestionSchema);
