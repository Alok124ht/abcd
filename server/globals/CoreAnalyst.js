const AsyncLock = require('async-lock');
const CoreAnalysis = require('../assessment/coreAnalysis.model').default;

const { initializeStats, updateHistogram } = require('../lib.js');

function copyCoreStats(coreAnalysis) {
	const stats = {};
	stats.marks = coreAnalysis.marks;
	stats.hist = coreAnalysis.hist;
	// stats.topper = coreAnalysis.topper;
	stats.sumAccuracy = coreAnalysis.sumAccuracy;
	stats.sumSqAccuracy = coreAnalysis.sumSqAccuracy;
	stats.sumPickingAbility = coreAnalysis.sumPickingAbility;
	stats.sumSqPickingAbility = coreAnalysis.sumSqPickingAbility;
	stats.difficulty = coreAnalysis.difficulty;
	stats.sumMarks = coreAnalysis.sumMarks;
	stats.maxMarks = coreAnalysis.maxMarks;
	stats.sections = coreAnalysis.sections.map((sec) => ({
		id: sec.id,
		incorrect: sec.incorrect,
		correct: sec.correct,
		sumMarks: sec.sumMarks,
		marks: sec.marks,
		sumTime: sec.sumTime,
		times: sec.times,
		hist: sec.hist,
		maxMarks: sec.maxMarks,
		questions: sec.questions.map((que) => ({
			id: que.id,
			sumSqTime: que.sumSqTime,
			sumTime: que.sumTime,
			times: que.times,
			correctAttempts: que.correctAttempts,
			totalAttempts: que.totalAttempts,
		})),
	}));
	return stats;
}

function updateSectionStats(
	sectionStats,
	difficultyStats,
	submissionSections, // meta.sections
	cSecs
) {
	const newSectionStats = sectionStats;
	const newDifficultyStats = difficultyStats;
	submissionSections.forEach((sec, sIdx) => {
		sec.questions.forEach((que, qIdx) => {
			const { question: cQ } = cSecs[sIdx].questions[qIdx];
			const isCorrect_ = que.correct === 1;
			const isAnswered_ = que.correct !== -1;
			const addToCorrect = que.correct === 1 ? 1 : 0;
			const addToIncorrect = que.correct === 0 ? 1 : 0;
			const addToAttempt = isAnswered_ ? 1 : 0;

			if (cQ.level === 1 && isAnswered_) {
				difficultyStats.easy.correct += addToCorrect;
				difficultyStats.easy.incorrect += addToIncorrect;
				difficultyStats.easy.time += que.time; // should we store only the correct time???
				difficultyStats.easy.times.push(que.time);
				difficultyStats.easy.totalAttempts += 1;
			} else if (cQ.level === 2 && isAnswered_) {
				difficultyStats.medium.correct += addToCorrect;
				difficultyStats.medium.incorrect += addToIncorrect;
				difficultyStats.medium.time += que.time; // should we store only the correct time???
				difficultyStats.medium.times.push(que.time); // should we store only the correct time???
				difficultyStats.medium.totalAttempts += 1;
			} else if (cQ.level === 3 && isAnswered_) {
				difficultyStats.hard.correct += addToCorrect;
				difficultyStats.hard.incorrect += addToIncorrect;
				difficultyStats.hard.time += que.time; // should we store only the correct time???
				difficultyStats.hard.times.push(que.time); // should we store only the correct time???
				difficultyStats.hard.totalAttempts += 1;
			}

			if (isCorrect_) {
				newSectionStats[sIdx].questions[qIdx].sumTime += que.time;
				newSectionStats[sIdx].questions[qIdx].times.push(que.time);
				newSectionStats[sIdx].questions[qIdx].sumSqTime += que.time * que.time;
			}
			if (isAnswered_) {
				newSectionStats[sIdx].questions[qIdx].correctAttempts += addToCorrect;
			}
			newSectionStats[sIdx].questions[qIdx].totalAttempts += addToAttempt;
		});
		newSectionStats[sIdx].sumTime += sec.time;
		newSectionStats[sIdx].times.push(sec.time);
		newSectionStats[sIdx].marks.push(sec.marks);
		newSectionStats[sIdx].sumMarks += sec.marks;
		newSectionStats[sIdx].correct += sec.correct;
		newSectionStats[sIdx].incorrect += sec.incorrect;
	});
	return { sectionStats: newSectionStats, difficultyStats: newDifficultyStats };
}

class CoreAnalyst {
	constructor() {
		this.submissionDataQueueMap = {};
		this.lock = new AsyncLock();
		// console.log('core analyst constructor called...', new Date());
	}

	enqueueSubmissionData(data, coreId) {
		if (this.submissionDataQueueMap[coreId]) {
			this.submissionDataQueueMap[coreId].push(data);
		} else {
			this.submissionDataQueueMap[coreId] = [data];
		}
	}

	dequeueSubmissionData(coreId) {
		if (!this.submissionDataQueueMap[coreId]) {
			return null;
		}
		if (!this.submissionDataQueueMap[coreId].length) {
			return null;
		}
		return this.submissionDataQueueMap[coreId].shift();
	}

	isQueueEmpty(coreId) {
		if (
			!this.submissionDataQueueMap[coreId] ||
			!this.submissionDataQueueMap[coreId].length
		) {
			return true;
		}
		return false;
	}

	analyseSubmissionData(coreId, assessmentCore) {
		// get assessmentCore
		// console.log('Analysing core', coreId);
		this.lock.acquire(
			coreId,
			(done) => {
				CoreAnalysis.findOne({ _id: coreId }).then((coreAnalysis) => {
					const stats =
						coreAnalysis.submissions && coreAnalysis.submissions.length
							? copyCoreStats(coreAnalysis, assessmentCore)
							: initializeStats(assessmentCore, assessmentCore.preAnalysis);

					while (!this.isQueueEmpty(coreId)) {
						// fetch data from queue

						const aaa = this.dequeueSubmissionData(coreId);
						// console.log('check aaa', aaa);
						const { meta, submissionId, userId, pickingAbility } = aaa;

						const { correctQuestions, incorrectQuestions, sections, marks } = meta;

						stats.marks.push({
							_id: submissionId,
							marks,
							user: userId,
						});
						stats.hist = updateHistogram(stats.hist, marks, stats.maxMarks);
						if (correctQuestions + incorrectQuestions) {
							const accuracy =
								(1.0 * correctQuestions) / (correctQuestions + incorrectQuestions);
							stats.sumAccuracy += accuracy;
							stats.sumSqAccuracy += accuracy * accuracy;
						}
						// nan? pns test 2

						stats.sumPickingAbility += pickingAbility;
						stats.sumSqPickingAbility += pickingAbility * pickingAbility;

						sections.forEach((sec, secIndex) => {
							stats.sections[secIndex].hist = updateHistogram(
								stats.sections[secIndex].hist,
								sec.marks,
								stats.sections[secIndex].maxMarks
							);
						});

						const tempData = updateSectionStats(
							stats.sections,
							stats.difficulty,
							sections,
							assessmentCore.sections,
							userId
						);

						stats.sections = tempData.sectionStats;
						stats.difficulty = tempData.difficultyStats;
						stats.sumMarks += marks;

						if (!coreAnalysis.submissions) {
							coreAnalysis.submissions = [];
						}
						coreAnalysis.submissions.push({
							submission: submissionId,
						});
					}

					stats.marks.sort((a, b) => b.marks - a.marks);

					coreAnalysis.marks = stats.marks;
					coreAnalysis.hist = stats.hist;
					// coreAnalysis.topper = stats.topper;
					coreAnalysis.sections = stats.sections.map((section) => ({
						id: section.id,
						incorrect: section.incorrect,
						correct: section.correct,
						sumMarks: section.sumMarks,
						marks: section.marks,
						sumTime: section.sumTime,
						times: section.times,
						hist: section.hist,
						questions: section.questions.map((question) => ({
							id: question.id,
							sumSqTime: question.sumSqTime,
							sumTime: question.sumTime,
							correctAttempts: question.correctAttempts,
							totalAttempts: question.totalAttempts,
							times: question.times,
						})),
					}));
					coreAnalysis.difficulty = stats.difficulty;
					coreAnalysis.maxMarks = stats.maxMarks;
					coreAnalysis.sumMarks = stats.sumMarks;
					coreAnalysis.sumAccuracy = stats.sumAccuracy;
					coreAnalysis.sumSqAccuracy = stats.sumSqAccuracy;

					coreAnalysis.sumPickingAbility = stats.sumPickingAbility;
					coreAnalysis.sumSqPickingAbility = stats.sumSqPickingAbility;
					coreAnalysis.lastSynced = new Date();
					// last synced, //last categorized
					const oldNumber = coreAnalysis.submissions
						? coreAnalysis.submissions.length
						: 0;

					coreAnalysis.totalAttempts = assessmentCore.preAnalysis
						? oldNumber + 30
						: oldNumber;

					coreAnalysis.markModified('marks');
					coreAnalysis.markModified('hist');
					coreAnalysis.markModified('topper');
					coreAnalysis.markModified('sections');
					coreAnalysis.markModified('difficulty');
					coreAnalysis.markModified('sumMarks');
					coreAnalysis.markModified('sumAccuracy');
					coreAnalysis.markModified('sumSqAccuracy');
					coreAnalysis.markModified('sumPickingAbility');
					coreAnalysis.markModified('sumSqPickingAbility');
					coreAnalysis.markModified('totalAttempts');
					coreAnalysis.markModified('submissions');
					coreAnalysis.markModified('lastSynced');
					coreAnalysis.save().then(() => {
						// console.log(coreId, 'work done');
						done(null, null);
					});
				});
			},
			() => {}
		);
	}
}

module.exports = new CoreAnalyst();
