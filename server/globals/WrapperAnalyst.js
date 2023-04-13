const { ObjectId } = require('mongodb');
const schedule = require('node-schedule');
const Bottleneck = require('bottleneck');
const Bucket = require('../bucket/bucket.model').default;
const WrapperData = require('./WrapperData');
const WrapperAnalysis = require('../assessment/wrapperAnalysis.model').default;
const AssessmentCore = require('../assessment/assessmentCore.model').default;

const lib = require('../lib.js');
const logger = require('../../config/winston').default;
const config = require('../../config/config');

const { initializeStats, getMaxMarks, getSecMaxMarks, updateHistogram } = lib;

function copyWrapperStats(wrapperAnalysis, assessmentCore) {
	const stats = {};
	stats.marks = wrapperAnalysis.marks;
	stats.hist = wrapperAnalysis.hist;
	// stats.topper = wrapperAnalysis.topper;
	stats.sumAccuracy = wrapperAnalysis.sumAccuracy;
	stats.sumSqAccuracy = wrapperAnalysis.sumSqAccuracy;
	stats.difficulty = wrapperAnalysis.difficulty;
	stats.sumMarks = wrapperAnalysis.sumMarks;
	stats.maxMarks = getMaxMarks(assessmentCore);
	stats.sections = wrapperAnalysis.sections.map((sec, i) => ({
		id: sec.id,
		incorrect: sec.incorrect,
		correct: sec.correct,
		sumMarks: sec.sumMarks,
		marks: sec.marks,
		marksWithUser: sec.marksWithUser ? sec.marksWithUser : [],
		sumTime: sec.sumTime,
		hist: sec.hist,
		times: sec.times,
		maxMarks: getSecMaxMarks(assessmentCore.sections[i]),
	}));
	return stats;
}

function updateSectionStats(
	sectionStats,
	difficultyStats,
	submissionSections, // meta.sections
	cSecs,
	user
) {
	const newSectionStats = sectionStats;
	const newDifficultyStats = difficultyStats;
	submissionSections.forEach((sec, sIdx) => {
		sec.questions.forEach((que, qIdx) => {
			const { question: cQ } = cSecs[sIdx].questions[qIdx];
			const isAnswered_ = que.correct !== -1;
			const addToCorrect = que.correct === 1 ? 1 : 0;
			const addToIncorrect = que.correct === 0 ? 1 : 0;

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
		});
		newSectionStats[sIdx].sumTime += sec.time;
		newSectionStats[sIdx].times.push(sec.time);
		newSectionStats[sIdx].marks.push(sec.marks);
		newSectionStats[sIdx].marksWithUser.push({
			marks: sec.marks,
			user: ObjectId(user),
		});
		newSectionStats[sIdx].sumMarks += sec.marks;
		newSectionStats[sIdx].correct += sec.correct;
		newSectionStats[sIdx].incorrect += sec.incorrect;
	});
	return { sectionStats: newSectionStats, difficultyStats: newDifficultyStats };
}

class WrapperAnalyst {
	constructor() {
		this.wrapperLimiter = new Bottleneck({
			maxConcurrent: 1,
			minTime: 60 * 1000,
		});
		this.submissionDataQueue = [];
		// console.log('wrapper analyst constructor called...', new Date());
	}

	saveData() {
		const wrapperDatas = [];
		while (this.submissionDataQueue.length) {
			wrapperDatas.push(this.submissionDataQueue.shift());
		}
		logger.info(`in WrapperAnalyst.saveData, item count: ${wrapperDatas.length}`);
		if (wrapperDatas.length) {
			// const t1 = new Date().getTime();
			WrapperData.insertMany(wrapperDatas, () => {});
		}
	}

	enqueueSubmissionData(data, wrapperAnalysisId) {
		// add a bottleneck
		this.submissionDataQueue.push({ wrapperAnalysis: wrapperAnalysisId, data });
		this.wrapperLimiter.schedule(() => this.saveData());
	}
}

function updateIncorrectQuestions(sections, aSections, userId) {
	const incorrectQuestions = [];
	const correctQuestions = [];

	// console.log('updating incorrectQuestions!!!');

	sections.forEach((sec, sIdx) => {
		sec.questions.forEach((que, qIdx) => {
			const { question } = aSections[sIdx].questions[qIdx];
			if (!que.correct) {
				incorrectQuestions.push(question);
			} else {
				correctQuestions.push(question);
			}
		});
	});

	Bucket.findOne({ user: ObjectId(userId) }).then((bucket) => {
		if (bucket) {
			const d = new Date();
			const babq = bucket.bookmarkedAtByQuestionId;
			const incorrects = [];
			let found = false;
			const incorrectMap = {};
			bucket.buckets.forEach((b) => {
				b.questions.forEach((q) => {
					incorrectMap[q] = babq && babq[q] ? babq[q] : d;
				});
				if (b.name === 'Incorrect' && b.default) {
					found = true;

					incorrectQuestions.forEach((q) => {
						incorrectMap[q] = d;
					});
					correctQuestions.forEach((q) => {
						delete incorrectMap[q];
					});
					b.questions = Object.keys(incorrectMap);
				}
			});
			bucket.bookmarkedAtByQuestionId = incorrectMap;
			if (!found) {
				bucket.buckets.push({
					name: 'Incorrect',
					color: '#ee4c48',
					default: true,
					questions: incorrectQuestions,
				});
			}
			bucket.markModified('buckets');
			bucket.markModified('bookmarkedAtByQuestionId');
			bucket.save();
		} else {
			// create
		}
	});
}

function hasSpentTooMuchTime(meta, maxDuration) {
	let sumTime = 0;
	meta.sections.forEach((section) => {
		section.questions.forEach((question) => {
			sumTime += question.time;
		});
	});
	if (sumTime > 1.1 * maxDuration) {
		return true;
	}
	return false;
}

function analyseSubmissionData() {
	// console.log('analysing submission');
	console.log('WrapperAnalyst > analyseSubmissionData: called');
	WrapperData.aggregate([
		{ $match: { used: { $ne: true } } },
		{ $group: { _id: '$wrapperAnalysis', total: { $sum: 1 } } },
	]).then((result) => {
		let maxIdx = -1;
		let maxCount = 0;
		result.forEach((r, i) => {
			if (r.total > maxCount) {
				maxCount = r.total;
				maxIdx = i;
			}
		});
		// console.log('check res', result);
		if (maxIdx !== -1) {
			console.log(
				'WrapperAnalyst > analyseSubmissionData: max!==-1, should analyse now'
			);
			const wrapperAnalysisId = result[maxIdx]._id;
			// console.log('analysing wrapperId', wrapperAnalysisId);

			const tn = new Date();
			WrapperAnalysis.findOneAndUpdate(
				{
					$or: [
						{ _id: wrapperAnalysisId, processedAt: { $exists: false } },
						{
							_id: wrapperAnalysisId,
							processedAt: { $lte: new Date(tn.getTime() - 60000) },
						},
					],
				},
				{ $set: { processedAt: new Date() } }
			).then((wrapperAnalysis) => {
				if (wrapperAnalysis) {
					WrapperData.find({
						wrapperAnalysis: wrapperAnalysisId,
						used: { $ne: true },
					}).then((dataList) => {
						const ids = dataList.map((d) => d._id);

						AssessmentCore.findOne({ _id: wrapperAnalysis.core })
							.populate('preAnalysis')
							.then((assessmentCore) => {
								if (assessmentCore) {
									const stats =
										wrapperAnalysis.submissions && wrapperAnalysis.submissions.length
											? copyWrapperStats(wrapperAnalysis, assessmentCore)
											: initializeStats(assessmentCore, assessmentCore.preAnalysis);

									dataList.forEach((d) => {
										const { meta, submissionId, userId } = d.data;
										updateIncorrectQuestions(
											meta.sections,
											assessmentCore.sections,
											userId
										);
										if (!hasSpentTooMuchTime(meta, assessmentCore.duration)) {
											const {
												correctQuestions,
												incorrectQuestions,
												sections,
												marks,
											} = meta;
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
											if (!wrapperAnalysis.submissions) {
												wrapperAnalysis.submissions = [];
											}
											wrapperAnalysis.submissions.push({
												submission: submissionId,
											});
										}
									});

									stats.marks.sort((a, b) => b.marks - a.marks);
									wrapperAnalysis.marks = stats.marks;
									wrapperAnalysis.hist = stats.hist;

									// wrapperAnalysis.topper = stats.topper;
									wrapperAnalysis.sections = stats.sections.map((section) => ({
										id: section.id,
										incorrect: section.incorrect,
										correct: section.correct,
										sumMarks: section.sumMarks,
										marks: section.marks,
										marksWithUser: section.marksWithUser,
										sumTime: section.sumTime,
										times: section.times,
										hist: section.hist,
									}));
									wrapperAnalysis.difficulty = stats.difficulty;
									wrapperAnalysis.sumMarks = stats.sumMarks;
									wrapperAnalysis.sumAccuracy = stats.sumAccuracy;
									wrapperAnalysis.sumSqAccuracy = stats.sumSqAccuracy;
									const oldNumber = wrapperAnalysis.submissions
										? wrapperAnalysis.submissions.length
										: 0;
									wrapperAnalysis.liveAttempts = assessmentCore.preAnalysis
										? oldNumber + 30
										: oldNumber;
									wrapperAnalysis.totalAttempts = assessmentCore.preAnalysis
										? oldNumber + 30
										: oldNumber;
									wrapperAnalysis.markModified('marks');
									wrapperAnalysis.markModified('hist');
									wrapperAnalysis.markModified('topper');
									wrapperAnalysis.markModified('sections');
									wrapperAnalysis.markModified('difficulty');
									wrapperAnalysis.markModified('sumMarks');
									wrapperAnalysis.markModified('sumAccuracy');
									wrapperAnalysis.markModified('sumSqAccuracy');
									wrapperAnalysis.markModified('liveAttempts');
									wrapperAnalysis.markModified('totalAttempts');
									wrapperAnalysis.markModified('submissions');
									wrapperAnalysis.save().then(() => {
										console.log(wrapperAnalysisId, 'work done');
										// done(null, null);
									});
								} else {
									console.log('assessment core not found');
								}
							});
						WrapperData.updateMany(
							{ _id: { $in: ids } },
							{ $set: { used: true } }
						).exec();
					});
				} else {
					console.log('assessment wrapper not found or ...');
				}
			});
		}
	});
}

function setUp() {
	/* Every hour except at 3AM */
	schedule.scheduleJob('*/1 * * * *', analyseSubmissionData);
	// schedule.scheduleJob('13 0-2/1 * * *', analyseSubmissionData);
	// schedule.scheduleJob('13 4-23/1 * * *', analyseSubmissionData);
}

if (config.env !== 'test') {
	setUp();
}

module.exports = new WrapperAnalyst();
