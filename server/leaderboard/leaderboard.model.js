const { cloneDeep } = require('lodash');
const Promise = require('bluebird');
const mongoose = require('mongoose');
const httpStatus = require('http-status');
const APIError = require('../helpers/APIError');

const UpdateLog = require('./updateLog.model');
const ObjectId = mongoose.Types.ObjectId;

const EloRating = require('elo-rating');

const LeaderboardSchema = new mongoose.Schema(
	{
		phase: {
			type: ObjectId,
			ref: 'Phase',
		},
		assessments: [
			{
				wrapper: {
					// make it primary key
					type: ObjectId,
					ref: 'AssessmentWrapper',
				},
				assessmentType: {
					type: String,
				},
				lastUpdated: {
					type: Date,
				},
				submissions: [
					{
						submission: {
							type: ObjectId,
							ref: 'Submission',
						},
						user: {
							type: ObjectId,
							ref: 'User',
						},
						marks: { type: Number, default: 0 },
					},
				],
			},
		],
		ratings: [
			//store last rated time!! and update ratings of least frequent updated users!
			{
				user: {
					type: ObjectId,
					ref: 'User',
				},
				rating: {
					type: Number,
					default: 0,
				},
				lastUpdated: {
					type: Date,
				},
			},
		],
		updatesRemaining: [
			{
				wrapper: { type: ObjectId, ref: 'AssessmentWrapper' },
				submission: { type: ObjectId, ref: 'Submission' },
			},
		],
		lastSynced: {
			type: Date,
			default: Date.now,
		},
	},
	{ timestamps: { createdAt: 'time' } }
);

function getLeastUpdated(leaderboard) {
	let lastUpdatedWrapper = null;
	leaderboard.assessments.forEach((assessment) => {
		if (!lastUpdatedWrapper) {
			lastUpdatedWrapper = assessment;
		} else if (!assessment.lastUpdated) {
			lastUpdatedWrapper = assessment;
		} else if (
			new Date(assessment.lastUpdated).getTime() <
			new Date(lastUpdatedWrapper.lastUpdated).getTime()
		) {
			lastUpdatedWrapper = assessment;
		}
	});
	if (lastUpdatedWrapper) {
		const updateTimes = {};
		leaderboard.ratings.forEach((rating) => {
			if (!rating.lastUpdated) {
				updateTimes[rating.user.toString()] = new Date().getTime();
			} else {
				updateTimes[rating.user.toString()] = new Date(
					rating.lastUpdated
				).getTime();
			}
		});
		let lastUpdatedUser = null;
		lastUpdatedWrapper.submissions.forEach((submission) => {
			if (!lastUpdatedUser) {
				lastUpdatedUser = submission;
			} else if (
				!updateTimes[submission.user.toString()] ||
				!updateTimes[lastUpdatedUser.user.toString()]
			) {
				lastUpdatedUser = submission;
			} else if (
				updateTimes[submission.user.toString()] <
				updateTimes[lastUpdatedUser.user.toString()]
			) {
				lastUpdatedUser = submission;
			}
		});
		if (lastUpdatedUser) {
			return {
				wrapper: lastUpdatedWrapper.wrapper,
				submission: lastUpdatedUser.submission,
			};
		} else {
			return null;
		}
	} else {
		return null;
	}
}

LeaderboardSchema.statics = {
	getupdatelog(leaderboard, n) {
		return UpdateLog.find({ leaderboard })
			.sort({ _id: -1 })
			.limit(20)
			.populate([{ path: 'usedUpdatesRemaining.wrapper', select: '_id name' }])
			.then((updatelogs) => {
				if (n >= updatelogs.length) {
					return Promise.resolve({});
				} else {
					return Promise.resolve(updatelogs[n]);
				}
			});
	},

	updateLeaderboard(phaseId, n) {
		const dateNow = new Date().getTime();

		let durationDiff = 0;
		let limit = 0;
		if (n === 0) {
			durationDiff = 0;
			limit = 0;
		} else if (n < 30) {
			durationDiff = 5 * 60 * 1000;
			limit = 100;
		} else if (n < 100) {
			durationDiff = 15 * 60 * 1000;
			limit = 80;
		} else if (n < 200) {
			durationDiff = 60 * 60 * 1000;
			limit = 70;
		} else if (n < 500) {
			durationDiff = 3 * 60 * 60 * 1000;
			limit = 60;
		} else {
			durationDiff = 12 * 60 * 60 * 1000;
			limit = 50;
		}

		this.findOne({
			phase: phaseId,
			lastSynced: { $lt: dateNow - durationDiff },
		}).then((leaderboard) => {
			if (leaderboard) {
				const userRatings = {};
				const userSubmissions = {};
				let maxSubmissions = 0;
				leaderboard.ratings.forEach((r) => {
					userRatings[r.user] = r.rating;
				});

				leaderboard.assessments.forEach((assessment) => {
					assessment.submissions.forEach((submission) => {
						if (!userSubmissions[submission.user.toString()]) {
							userSubmissions[submission.user.toString()] = 0;
						}
						userSubmissions[submission.user.toString()] += 1;
						maxSubmissions = Math.max(
							maxSubmissions,
							userSubmissions[submission.user.toString()]
						);
					});
				});

				const delUserRatings = {};
				const ratingUpdates = {};
				const usedUpdatesRemaining = [];

				const leastUpdated = getLeastUpdated(leaderboard);

				const updatesRemaining_ = leaderboard.updatesRemaining.splice(0, limit);
				if (leastUpdated) {
					updatesRemaining_.push(leastUpdated);
				}

				const leaderboardUpdates = {};

				updatesRemaining_.forEach((uR) => {
					usedUpdatesRemaining.push(uR);
					let assessmentIdx = -1;
					let submissionIdx = -1;

					leaderboard.assessments.forEach((assessment, idx1) => {
						if (assessment.wrapper.toString() == uR.wrapper.toString()) {
							assessmentIdx = idx1;
							leaderboardUpdates['assessments.' + idx1 + '.lastUpdated'] = new Date();
							assessment.submissions.forEach((submission, idx2) => {
								if (submission.submission.toString() == uR.submission.toString()) {
									submissionIdx = idx2;
								}
							});
						}
					});

					if (assessmentIdx != -1 && submissionIdx != -1) {
						const referenceSubmission =
							leaderboard.assessments[assessmentIdx].submissions[submissionIdx];
						const referenceMarks = referenceSubmission.marks;
						const referenceRating = userRatings[referenceSubmission.user]
							? userRatings[referenceSubmission.user]
							: 1600;

						let f = 10;
						if (
							leaderboard.assessments[assessmentIdx].assessmentType === 'TOPIC-MOCK'
						) {
							f = 3;
						} else if (
							leaderboard.assessments[assessmentIdx].assessmentType === 'LIVE-TEST'
						) {
							f = 15;
						}
						if (n === 0) {
							f = f / 10.0;
						}

						let totalChange = 0;
						let totalOpponents = 0;
						leaderboard.assessments[assessmentIdx].submissions.forEach(
							(submission, idx) => {
								if (idx != submissionIdx) {
									const opponentMarks = submission.marks;
									const opponentRating = userRatings[submission.user]
										? userRatings[submission.user]
										: 1600;

									if (referenceMarks != opponentMarks) {
										const result = EloRating.calculate(
											referenceRating,
											opponentRating,
											referenceMarks > opponentMarks
										);

										totalChange += f * (result.playerRating - referenceRating);
										totalOpponents += 1;

										if (!delUserRatings[submission.user]) {
											delUserRatings[submission.user] = 0;
										}
										if (!ratingUpdates[submission.user]) {
											ratingUpdates[submission.user] = 0;
										}
										ratingUpdates[submission.user] += 1;
										delUserRatings[submission.user] +=
											f * (result.opponentRating - opponentRating);
									}
								}
							}
						);
						if (!delUserRatings[referenceSubmission.user]) {
							delUserRatings[referenceSubmission.user] = 0;
						}
						delUserRatings[referenceSubmission.user] += totalOpponents
							? totalChange / totalOpponents
							: 0;
					}
				});

				Object.keys(delUserRatings).forEach((u) => {
					if (ratingUpdates[u]) {
						delUserRatings[u] /= ratingUpdates[u];
					}
				});

				const ratingsData = [];

				leaderboard.ratings.forEach((r) => {
					if (delUserRatings[r.user]) {
						const initialRating = r.rating;

						if (!userSubmissions[r.user]) userSubmissions[r.user] = 0;
						if (!maxSubmissions) maxSubmissions = 1;

						const upperCap =
							1740 + 126 * Math.floor((10 * userSubmissions[r.user]) / maxSubmissions);

						const finalRating = Math.min(upperCap, r.rating + delUserRatings[r.user]);

						r.rating = finalRating;
						r.lastUpdated = new Date();
						ratingsData.push({
							user: r.user,
							initialRating: initialRating,
							finalRating: finalRating,
							delRating: finalRating - initialRating,
						});
					}
				});

				Object.keys(delUserRatings).forEach((k) => {
					if (!userRatings[k]) {
						leaderboard.ratings.push({
							user: k,
							rating: 1600 + delUserRatings[k],
							lastUpdated: new Date(),
						});
						ratingsData.push({
							user: k,
							initialRating: 1600,
							finalRating: 1600 + delUserRatings[k],
							delRating: delUserRatings[k],
						});
					}
				});

				leaderboardUpdates['updatesRemaining'] = leaderboard.updatesRemaining;
				leaderboardUpdates['lastSynced'] = new Date();
				leaderboardUpdates['ratings'] = leaderboard.ratings;

				this.update(
					{ _id: leaderboard._id },
					{
						$set: leaderboardUpdates,
					}
				).then(() => {
					UpdateLog.log(leaderboard._id, ratingsData, usedUpdatesRemaining);
				});
			}
		});
	},
};

module.exports = mongoose.model('Leaderboard', LeaderboardSchema);
