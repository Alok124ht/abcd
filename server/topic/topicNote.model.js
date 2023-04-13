const Promise = require('bluebird');
const mongoose = require('mongoose');

const ObjectId = mongoose.Schema.Types.ObjectId;

const TopicNoteSchema = new mongoose.Schema(
	{
		//user-subtopicId should be unique!!
		//only one preferred for one subtopic
		subTopicId: {
			type: String,
			required: true,
		},
		user: {
			type: ObjectId,
			ref: 'User',
		},
		preferred: {
			//to find if its default or modified
			type: Boolean,
			default: false,
		},
		note: {
			type: Object,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

TopicNoteSchema.statics = {};

module.exports = mongoose.model('TopicNote', TopicNoteSchema);
