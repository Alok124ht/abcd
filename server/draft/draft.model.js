const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;
const DraftSchema = new mongoose.Schema(
	{
		defaultQuestionTimeLimit: { type: Number },
		name: {
			type: String,
			required: true,
		},
		duration: {
			// number of seconds
			type: Number,
			required: true,
		},
		sections: [
			{
				// add marks too in draft!!
				name: String,
				duration: {
					type: Number,
					default: -1,
				},
				questionGroups: [
					{
						questions: [{ type: Number }],
						selectionType: { type: String, enum: ['PFS'] },
						selectNumberOfQuestions: { type: Number },
					},
				],
				questions: [
					{
						question: {
							type: ObjectId,
							ref: 'Question',
						},
						topic: String,
						sub_topic: String,
						correctMark: {
							type: Number,
							default: 4,
						},
						incorrectMark: {
							type: Number,
							default: -1,
						},
						timeLimit: {
							type: Number,
						},
						shouldBeChanged: Boolean,
					},
				],
			},
		],
		sectionGroups: [
			{
				/**
				 * index of sections
				 */
				sections: [{ type: Number }],
				/**
				 * selectionType HIGHEST_SCORE means select sections with highest scores
				 */
				selectionType: { type: String, enum: ['HIGHEST_SCORE'] },
				selectNumberOfSections: { type: Number },
			},
		],
		supergroup: {
			type: ObjectId,
			ref: 'SuperGroup',
		},
		correct: Number,
		incorrect: Number,
		correctMultiple: Number,
		incorrectMultiple: Number,
		correctNumerical: Number,
		incorrectNumerical: Number,
		instructions: {
			type: Array,
		},
		customInstructions: [{ type: String }],
		instructionType: {
			type: String,
			enum: ['NONE', '8SCQ8MCQ2L-P', '4SCQ10MCQ4NUM-P', '20SCQ5NUM'],
		},
		markingScheme: {
			multipleCorrect: {
				type: String,
				enum: ['NO_PARTIAL', 'JEE_2019'],
			},
			matchTheColumns: {
				type: String,
				enum: ['NO_PARTIAL', 'JEE_2019'],
			},
		},
		isArchived: {
			type: Boolean,
			default: false,
		},
		config: {
			questionNumbering: {
				type: String,
				enum: ['overall-increasing', 'section-wise-increasing'],
			},
			extraSections: [{ type: Number }],
		},
		client: {
			type: ObjectId,
			ref: 'Client',
		},
	},
	{ timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = mongoose.model('Draft', DraftSchema);
