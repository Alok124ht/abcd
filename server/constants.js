module.exports = {
	batch: 1,
	initialQuestionRatingLow: 1300,
	initialQuestionRatingMedium: 1500,
	initialQuestionRatingHigh: 1700,
	initialUserRatingLow: 1450,
	initialUserRatingMedium: 1600,
	initialUserRatingHigh: 1750,
	kRating0: 128,
	kRating1: 64,
	kRating2: 32,
	xp: {
		signup: 300,
		new_subscription: 300,
		practice_base: 5,
		assessment_cost: 50, // this is default. but can be changed from admin panel!!
		assessment_reward: 250,
		referralBonus: 200,
	},
	goal: {
		f1: 0.5,
		f2: 0.9,
		f3: 1.5,
	},
	questionTypeMap: {
		LINKED_MULTIPLE_CHOICE_SINGLE_CORRECT: 'MULTIPLE_CHOICE_SINGLE_CORRECT',
		LINKED_MULTIPLE_CHOICE_MULTIPLE_CORRECT: 'MULTIPLE_CHOICE_MULTIPLE_CORRECT',
		LINKED_RANGE: 'RANGE',
	},
};
