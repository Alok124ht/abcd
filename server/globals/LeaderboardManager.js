const Bottleneck = require('bottleneck');

const Leaderboard = require('../leaderboard/leaderboard.model');

class LeaderboardManager {
	constructor() {
		this.leaderboardDataQueueMap = {};
		this.leaderboardLimiter = new Bottleneck({
			maxConcurrent: 1,
			minTime: 10 * 1000,
		});
	}

	dequeueLeaderboardData(key) {
		if (!this.leaderboardDataQueueMap[key]) {
			return null;
		}
		if (!this.leaderboardDataQueueMap[key].length) {
			return null;
		}
		return this.leaderboardDataQueueMap[key].shift();
	}

	isQueueEmpty(key) {
		if (
			!this.leaderboardDataQueueMap[key] ||
			!this.leaderboardDataQueueMap[key].length
		) {
			return true;
		}
		return false;
	}

	updateLeaderboard(key) {
		const d_ = key.split('_');
		const phaseId = d_[0];
		const wrapperId = d_[1];
		const wrapperType = d_[2];
		const data = [];
		const updateData = [];
		while (!this.isQueueEmpty(key)) {
			const { submissionId, userId, marks } = this.dequeueLeaderboardData(key);
			data.push({ submission: submissionId, user: userId, marks });
			updateData.push({ wrapper: wrapperId, submission: submissionId });
		}

		Leaderboard.findOne({
			phase: phaseId,
		}).then((leaderboard) => {
			if (leaderboard === null) {
				const leaderboard_ = new Leaderboard({
					phase: phaseId,
					assessments: [
						{
							wrapper: wrapperId,
							assessmentType: wrapperType,
							submissions: data,
						},
					],
					ratings: [],
					updatesRemaining: [], // should it be empty?
				});
				leaderboard_.save().then(() => {
					Leaderboard.updateLeaderboard(phaseId, leaderboard_.ratings.length);
				});
			} else {
				let assessmentIdx = -1;
				let submissionFound = false;
				leaderboard.assessments.forEach((assessment, idx1) => {
					if (assessment.wrapper.toString() == wrapperId) {
						assessmentIdx = idx1;
						assessment.submissions.forEach((sub_) => {
							// think about it
							// if (sub_.submission.toString() == submission._id.toString()) {
							// 	submissionFound = true;
							// }
						});
					}
				});
				if (assessmentIdx === -1) {
					const query = {
						assessments: {
							wrapper: wrapperId,
							assessmentType: wrapperType,
							submissions: data,
						},
						updatesRemaining: updateData,
					};
					Leaderboard.update(
						{
							phase: phaseId,
						},
						{
							$push: query,
						}
					).then(() => {
						Leaderboard.updateLeaderboard(phaseId, leaderboard.ratings.length);
					});
				} else {
					const query = {
						updatesRemaining: updateData,
					};
					query[`assessments.${assessmentIdx}.submissions`] = data;
					Leaderboard.update(
						{
							phase: phaseId,
						},
						{
							$push: query,
						}
					).then(() => {
						Leaderboard.updateLeaderboard(phaseId, leaderboard.ratings.length);
					});
				}
			}
		});
	}

	enqueueLeaderboardData(data, wrapperId, phaseId, wrapperType) {
		const key = `${phaseId}_${wrapperId}_${wrapperType}`;
		if (this.leaderboardDataQueueMap[key]) {
			this.leaderboardDataQueueMap[key].push(data);
		} else {
			this.leaderboardDataQueueMap[key] = [data];
		}
	}

	processLeaderboard() {
		const kk = this.leaderboardDataQueueMap;
		let maxCount = 0;
		let maxKey = '';
		Object.keys(kk).forEach((k) => {
			if (kk[k] && kk[k].length > maxCount) {
				maxCount = kk[k].length;
				maxKey = k;
			}
		});
		if (maxCount && maxKey) {
			this.leaderboardLimiter.schedule(() => this.updateLeaderboard(maxKey));
		}
	}
}

module.exports = new LeaderboardManager();
