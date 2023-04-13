const mongoose = require('mongoose');

const ObjectId = mongoose.Types.ObjectId;

const UserxpSchema = new mongoose.Schema(
	{
		user: {
			type: ObjectId,
			ref: 'User',
			unique: true,
		},
		xp: [
			{
				val: Number,
				reference: {
					type: ObjectId,
					refPath: 'onModel',
				},
				onModel: {
					type: String,
					required: true,
					enum: ['Attempt', 'Assessment', 'Referral', 'User', 'Session', 'Question'],
				},
				description: {
					type: String,
					default: '',
				},
				campaignName: {
					type: String,
				},
			},
		],
		net: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
		usePushEach: true,
	}
);

UserxpSchema.pre('save', function calculateNet(next) {
	if (this.xp && Array.isArray(this.xp)) {
		// this is not called when using .update()
		this.net = Math.floor(this.xp.reduce((sum, item) => sum + item.val, 0));
	}
	next();
});

UserxpSchema.post('save', (doc, next) => {
	// this is not called when using .update()
	const User = mongoose.model('User');
	User.update({ _id: doc.user }, { 'netXp.val': doc.net }, () => {
		next();
	});
});

module.exports = mongoose.model('Userxp', UserxpSchema);
