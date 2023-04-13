/*
	Description: Assessment related queries of user
	Creator: Hitesh Jangid
	Date: 12 Aug, 20

*/

const Submission = require('../assessment/submission.model').default;
const AssessmentTypeCache = require('../cache/AssessmentType');
const WrapperStatsCache = require('../cache/WrapperStats');
const UserCache = require('../cache/User');
const { forEach, size } = require('lodash');
const AssessmentCoreCache = require('../cache/AssessmentCore');
const logger = require('../../config/winston').default;
const { getActivePhasesFromSubscriptions } = require('../utils/phase');
const { performance, PerformanceObserver } = require('perf_hooks');
const { getMaxMarks, getSecMaxMarks } = require('../lib');
const APIError = require('../helpers/APIError');
const { get } = require('lodash');

const perfObserver = new PerformanceObserver((items) => {
	items.getEntries().forEach((entry) => {
		logger.info(`measure: name(${entry.name}) duration(${entry.duration})`);
	});
});

perfObserver.observe({ entryTypes: ['measure'], buffer: true });

function getSectionIdx(stat) {
	let phy = -1;
	let chem = -1;
	let math = -1;
	if (stat && stat.core && stat.core.sections) {
		stat.core.sections.forEach((s, idx) => {
			if (s.name.toLowerCase().indexOf('phy') !== -1) {
				phy = idx;
			} else if (s.name.toLowerCase().indexOf('chem') !== -1) {
				chem = idx;
			} else if (s.name.toLowerCase().indexOf('math') !== -1) {
				math = idx;
			}
		});
	}
	return { phy, chem, math };
}

function getPaperReport(
	stats,
	submissions,
	cummulativeData,
	cummulativePhyData,
	cummulativeChemData,
	cummulativeMathData,
	cummulativeMarks,
	cummulativePhyMarks,
	cummulativeChemMarks,
	cummulativeMathMarks
) {
	const marks = {};
	const phyMarks = {};
	const chemMarks = {};
	const mathMarks = {};
	stats.forEach((stat) => {
		stat.marks.forEach((m) => {
			if (!marks[m.user]) {
				marks[m.user] = 0;
			}
			if (!cummulativeData[m.user]) {
				cummulativeData[m.user] = 0;
			}
			marks[m.user] += m.marks;
			cummulativeData[m.user] += m.marks;
		});
		const { phy, chem, math } = getSectionIdx(stat);

		if (phy !== -1 && chem !== -1 && math !== -1) {
			const phyMarks_ = stat.sections[phy].marksWithUser;
			const chemMarks_ = stat.sections[chem].marksWithUser;
			const mathMarks_ = stat.sections[math].marksWithUser;

			if (phyMarks_) {
				phyMarks_.forEach((m) => {
					if (!phyMarks[m.user]) {
						phyMarks[m.user] = 0;
					}
					phyMarks[m.user] += m.marks;
					if (!cummulativePhyData[m.user]) {
						cummulativePhyData[m.user] = 0;
					}
					cummulativePhyData[m.user] += m.marks;
				});
			}
			if (chemMarks_) {
				chemMarks_.forEach((m) => {
					if (!chemMarks[m.user]) {
						chemMarks[m.user] = 0;
					}
					chemMarks[m.user] += m.marks;
					if (!cummulativeChemData[m.user]) {
						cummulativeChemData[m.user] = 0;
					}
					cummulativeChemData[m.user] += m.marks;
				});
			}
			if (mathMarks_) {
				mathMarks_.forEach((m) => {
					if (!mathMarks[m.user]) {
						mathMarks[m.user] = 0;
					}
					mathMarks[m.user] += m.marks;
					if (!cummulativeMathData[m.user]) {
						cummulativeMathData[m.user] = 0;
					}
					cummulativeMathData[m.user] += m.marks;
				});
			}
		}
	});

	let userMarks = 0;
	let userPhyMarks = 0;
	let userChemMarks = 0;
	let userMathMarks = 0;

	const statsMap = {};
	stats.forEach((stat) => {
		statsMap[stat._id] = stat;
	});

	submissions.forEach((submission) => {
		if (submission.meta && submission.meta.marks) {
			userMarks += submission.meta.marks;
			cummulativeMarks += submission.meta.marks;
		}
		const stat = statsMap[submission.wrapperAnalysis];
		const { phy, chem, math } = getSectionIdx(stat);
		if (phy !== -1 && chem !== -1 && math !== -1) {
			if (submission.meta && submission.meta.sections) {
				userPhyMarks += submission.meta.sections[phy].marks;
				userChemMarks += submission.meta.sections[chem].marks;
				userMathMarks += submission.meta.sections[math].marks;
				cummulativePhyMarks += submission.meta.sections[phy].marks;
				cummulativeChemMarks += submission.meta.sections[chem].marks;
				cummulativeMathMarks += submission.meta.sections[math].marks;
			}
		}
	});

	let usersAhead = 0;
	let totalUsers = 0;
	let avgMarks = 0;
	let topper = {};
	Object.keys(marks).map((m) => {
		if (marks[m] > userMarks) {
			usersAhead += 1;
		}
		totalUsers += 1;
		avgMarks += marks[m];
		if (!topper.marks) {
			topper = { user: m, marks: marks[m] };
		} else if (topper.marks < marks[m]) {
			topper = { user: m, marks: marks[m] };
		}
	});
	const percentile = totalUsers ? 100 - (100 * usersAhead) / totalUsers : 0;
	if (totalUsers) {
		avgMarks /= totalUsers;
	}

	let userPhyAhead = 0;
	let totalPhyUsers = 0;
	let phyAvgMarks = 0;
	let topperPhyMarks = 0;
	Object.keys(phyMarks).map((m) => {
		if (phyMarks[m] > userPhyMarks) {
			userPhyAhead += 1;
		}
		totalPhyUsers += 1;
		phyAvgMarks += phyMarks[m];
		if (topper && topper.user.toString() == m.toString()) {
			topperPhyMarks = phyMarks[m];
		}
	});

	const phyPercentile = totalPhyUsers
		? 100 - (100 * userPhyAhead) / totalPhyUsers
		: 0;
	if (totalPhyUsers) {
		phyAvgMarks /= totalPhyUsers;
	}

	let userChemAhead = 0;
	let totalChemUsers = 0;
	let chemAvgMarks = 0;
	let topperChemMarks = 0;
	Object.keys(chemMarks).map((m) => {
		if (chemMarks[m] > userChemMarks) {
			userChemAhead += 1;
		}
		totalChemUsers += 1;
		chemAvgMarks += chemMarks[m];
		if (topper && topper.user.toString() == m.toString()) {
			topperChemMarks = chemMarks[m];
		}
	});
	const chemPercentile = totalChemUsers
		? 100 - (100 * userChemAhead) / totalChemUsers
		: 0;
	if (totalChemUsers) {
		chemAvgMarks /= totalChemUsers;
	}

	let userMathAhead = 0;
	let totalMathUsers = 0;
	let mathAvgMarks = 0;
	let topperMathMarks = 0;
	Object.keys(mathMarks).map((m) => {
		if (mathMarks[m] > userMathMarks) {
			userMathAhead += 1;
		}
		totalMathUsers += 1;
		mathAvgMarks += mathMarks[m];
		if (topper && topper.user.toString() == m.toString()) {
			topperMathMarks = mathMarks[m];
		}
	});
	const mathPercentile = totalMathUsers
		? 100 - (100 * userMathAhead) / totalMathUsers
		: 0;
	if (totalMathUsers) {
		mathAvgMarks /= totalMathUsers;
	}

	/*
	 * Find cummulative performance
	 */
	let cumUsersAhead = 0;
	let cumTotalUsers = 0;
	Object.keys(cummulativeData).map((m) => {
		if (cummulativeData[m] > cummulativeMarks) {
			cumUsersAhead += 1;
		}
		cumTotalUsers += 1;
	});
	const cumPercentile = cumTotalUsers
		? 100 - (100 * cumUsersAhead) / cumTotalUsers
		: 0;
	/* cummulative performance ends */

	/*
	 * Find subject wise cummulative performance
	 */
	let cumPhyUsersAhead = 0;
	let cumPhyTotalUsers = 0;
	Object.keys(cummulativePhyData).map((m) => {
		if (cummulativePhyData[m] > cummulativePhyMarks) {
			cumPhyUsersAhead += 1;
		}
		cumPhyTotalUsers += 1;
	});
	const cumPhyPercentile = cumPhyTotalUsers
		? 100 - (100 * cumPhyUsersAhead) / cumPhyTotalUsers
		: 0;

	let cumChemUsersAhead = 0;
	let cumChemTotalUsers = 0;
	Object.keys(cummulativeChemData).map((m) => {
		if (cummulativeChemData[m] > cummulativeChemMarks) {
			cumChemUsersAhead += 1;
		}
		cumChemTotalUsers += 1;
	});
	const cumChemPercentile = cumChemTotalUsers
		? 100 - (100 * cumChemUsersAhead) / cumChemTotalUsers
		: 0;

	let cumMathUsersAhead = 0;
	let cumMathTotalUsers = 0;
	Object.keys(cummulativeMathData).map((m) => {
		if (cummulativeMathData[m] > cummulativeMathMarks) {
			cumMathUsersAhead += 1;
		}
		cumMathTotalUsers += 1;
	});
	const cumMathPercentile = cumMathTotalUsers
		? 100 - (100 * cumMathUsersAhead) / cumMathTotalUsers
		: 0;
	/* cummulative performance ends */

	return {
		perfData: {
			avgMarks,
			userMarks,
			percentile,
			topperMarks: topper.marks ? topper.marks : 0,
			userPhyMarks,
			userChemMarks,
			userMathMarks,
			phyAvgMarks,
			chemAvgMarks,
			mathAvgMarks,
			topperPhyMarks,
			topperChemMarks,
			topperMathMarks,
			phyPercentile,
			chemPercentile,
			mathPercentile,
			cumPercentile,
			cumPhyPercentile,
			cumChemPercentile,
			cumMathPercentile,
		},
		cummulativeData: cummulativeData,
		cummulativePhyData: cummulativePhyData,
		cummulativeChemData: cummulativeChemData,
		cummulativeMathData: cummulativeMathData,
		cummulativeMarks: cummulativeMarks,
		cummulativePhyMarks: cummulativePhyMarks,
		cummulativeChemMarks: cummulativeChemMarks,
		cummulativeMathMarks: cummulativeMathMarks,
	};
}

function createReport(
	statsMap,
	submissionMap,
	uid,
	testDetailsByAnalysisId,
	assessmentGroups
) {
	let cummulativeData = {};
	let cummulativePhyData = {};
	let cummulativeChemData = {};
	let cummulativeMathData = {};
	let cummulativeMarks = 0;
	let cummulativePhyMarks = 0;
	let cummulativeChemMarks = 0;
	let cummulativeMathMarks = 0;
	const reports = assessmentGroups.map((assessmentGroup) => {
		const stats = assessmentGroup.map((i) => statsMap[i]);
		const submissions = assessmentGroup
			.filter((id) => submissionMap[id])
			.map((id) => submissionMap[id]);

		const name = assessmentGroup
			.map((id) => testDetailsByAnalysisId[id].name)
			.join(' & ');
		const dates = assessmentGroup.map(
			(id) => testDetailsByAnalysisId[id].availableFrom
		);

		const data = getPaperReport(
			stats,
			submissions,
			cummulativeData,
			cummulativePhyData,
			cummulativeChemData,
			cummulativeMathData,
			cummulativeMarks,
			cummulativePhyMarks,
			cummulativeChemMarks,
			cummulativeMathMarks
		);
		cummulativeData = data.cummulativeData;
		cummulativePhyData = data.cummulativePhyData;
		cummulativeChemData = data.cummulativeChemData;
		cummulativeMathData = data.cummulativeMathData;
		cummulativeMarks = data.cummulativeMarks;
		cummulativePhyMarks = data.cummulativePhyMarks;
		cummulativeChemMarks = data.cummulativeChemMarks;
		cummulativeMathMarks = data.cummulativeMathMarks;
		const perfData = data.perfData;
		perfData.name = name;
		perfData.dates = dates;
		return perfData;
	});

	return reports;
}

function getTestDetails(test, activePhases) {
	let name = test.name;
	let availableFrom = test.availableFrom;
	test.phases.forEach((phase) => {
		if (activePhases.includes(phase.phase.toString()) && phase.name) {
			name = phase.name;
			if (phase.availableFrom) {
				availableFrom = phase.availableFrom;
			}
		}
	});
	return { name, availableFrom };
}

function sortWrappers(wrappers, activePhases) {
	wrappers.sort((a, b) => {
		let aTime = a.availableFrom;
		let bTime = b.availableFrom;
		//
		a.phases.forEach((phase) => {
			if (activePhases.includes(phase.phase.toString()) && phase.availableFrom) {
				aTime = phase.availableFrom;
			}
		});
		b.phases.forEach((phase) => {
			if (activePhases.includes(phase.phase.toString()) && phase.availableFrom) {
				bTime = phase.availableFrom;
			}
		});
		const aTimeDate = new Date(aTime).getTime();
		const bTimeDate = new Date(bTime).getTime();

		if (aTimeDate < bTimeDate) {
			return -1;
		}
		if (aTimeDate > bTimeDate) {
			return 1;
		}
		return 0;
	});
	return wrappers;
}

function createAssessmentGroupReport(
	statsMap,
	submissionByWrapperAnalysisId,
	assessmentGroups,
	testDetailsByAnalysisId,
	sectionConfigs,
	userId
) {
	/**
	 * report per assessment group
	 */
	const groupReports = [];
	const cumulativeScorecardByUserId = {};
	forEach(assessmentGroups, (assessmentGroup) => {
		const scorecardByUserId = {};
		const assessmentGroupDetails = [];
		const maxMarks = { overall: 0 };
		forEach(assessmentGroup, (wrapperAnalysisId) => {
			assessmentGroupDetails.push(testDetailsByAnalysisId[wrapperAnalysisId]);
			const sectionIndexById = {};
			const sectionIdByIndex = {};
			const wrapperStats = statsMap[wrapperAnalysisId];
			maxMarks.overall += wrapperStats.maxMarks.overall;
			const marksList = wrapperStats.marks;
			wrapperStats.core.sections.forEach(({ name }, sectionIndex) => {
				sectionConfigs.some((config) => {
					if (config.regex.test(name)) {
						sectionIndexById[config.id] = sectionIndex;
						sectionIdByIndex[sectionIndex] = config.id;
						if (!maxMarks[config.id]) {
							maxMarks[config.id] = 0;
						}
						maxMarks[config.id] += wrapperStats.maxMarks[config.id];
						return true;
					}
					return false;
				});
			});
			forEach(marksList, (item) => {
				if (typeof scorecardByUserId[item.user] === 'undefined') {
					if (!scorecardByUserId[item.user]) {
						scorecardByUserId[item.user] = {};
					}
				}
				if (!scorecardByUserId[item.user].overall) {
					scorecardByUserId[item.user].overall = { marks: 0 };
				}
				scorecardByUserId[item.user].overall.marks += item.marks;
			});
			forEach(wrapperStats.sections, ({ marksWithUser }, sectionIndex) => {
				const sectionId = sectionIdByIndex[sectionIndex];
				forEach(marksWithUser, (item) => {
					if (!scorecardByUserId[item.user][sectionId]) {
						scorecardByUserId[item.user][sectionId] = { marks: 0 };
					}
					scorecardByUserId[item.user][sectionId].marks += item.marks;
				});
			});
		});
		let topper = { overall: { marks: -1 * Infinity } };
		forEach(scorecardByUserId, (item) => {
			if (item.overall.marks > topper.overall.marks) {
				topper = item;
			}
		});

		const numberOfUsers = Math.max(1, size(scorecardByUserId));
		const statsBySection = {};
		const userScorecard = scorecardByUserId[userId];
		let timesErrorOccurred = 0;
		let oneErrorMessage = null;
		forEach(
			['overall', ...sectionConfigs.map((config) => config.id)],
			(sectionId) => {
				try {
					let totalMarks = 0;
					let highestMarks = -1 * Infinity;
					let usersBehindInAssessmentGroupScore = 0;
					const userMarks = get(userScorecard, [sectionId, 'marks'], 0);
					forEach(scorecardByUserId, (itemScorecard, itemUserId) => {
						const itemMarks = get(itemScorecard, [sectionId, 'marks'], 0);
						totalMarks += itemMarks;
						if (itemMarks <= userMarks) {
							usersBehindInAssessmentGroupScore += 1;
						}
						if (itemMarks > highestMarks) {
							highestMarks = itemMarks;
						}
						if (!cumulativeScorecardByUserId[itemUserId]) {
							cumulativeScorecardByUserId[itemUserId] = {};
						}
						if (!cumulativeScorecardByUserId[itemUserId][sectionId]) {
							cumulativeScorecardByUserId[itemUserId][sectionId] = { marks: 0 };
						}
						cumulativeScorecardByUserId[itemUserId][sectionId].marks +=
							itemScorecard[sectionId].marks;
					});
					let usersBehindInCumulativeScore = 0;
					const userCumulativeScore =
						cumulativeScorecardByUserId[userId][sectionId].marks;
					forEach(cumulativeScorecardByUserId, (cumulativeScorecardItem) => {
						if (cumulativeScorecardItem[sectionId].marks <= userCumulativeScore) {
							usersBehindInCumulativeScore += 1;
						}
					});
					const averageMarks = parseInt(totalMarks / numberOfUsers, 10);
					const percentile =
						parseInt(
							(100 * 100 * usersBehindInAssessmentGroupScore) / numberOfUsers,
							10
						) / 100;

					const cumulativePercentile =
						parseInt(
							(100 * 100 * usersBehindInCumulativeScore) /
								Math.max(1, size(cumulativeScorecardByUserId)),
							10
						) / 100;
					statsBySection[sectionId] = {
						averageMarks,
						percentile,
						highestMarks,
						cumulativePercentile,
					};
				} catch (e) {
					timesErrorOccurred += 1;
					oneErrorMessage = e.message;
				}
			}
		);
		// it is set to 2 to reduce the number of logs going to logger
		if (timesErrorOccurred > 2) {
			logger.error(
				`user.assessment.controller > createAssessmentGroupReport: Error occurred ${timesErrorOccurred}, last error was ${oneErrorMessage}`
			);
		}

		groupReports.push({
			user: scorecardByUserId[userId],
			topper,
			statsBySection,
			details: assessmentGroupDetails,
			maxMarks,
		});
	});
	return groupReports;
}

function getReports(req, res, next) {
	const {
		payload: { id: singedInUserId, role },
	} = req;
	const paramsUserId = req.query.user;
	const { newReport } = req.query;
	let isMentorOrAbove = false;
	if (
		role === 'mentor' ||
		role === 'moderator' ||
		role === 'admin' ||
		role === 'super'
	) {
		isMentorOrAbove = true;
	}
	const id = isMentorOrAbove && paramsUserId ? paramsUserId : singedInUserId;

	const sectionConfigs = [
		{
			regex: /phy/i,
			id: 'physics',
			name: 'Physics',
		},
		{
			id: 'mathematics',
			regex: /math/i,
			name: 'Mathematics',
		},
		{
			regex: /chem/i,
			id: 'chemistry',
			name: 'Chemistry',
		},
		{
			regex: /bio/i,
			id: 'biology',
			name: 'Biology',
		},
		{
			regex: /apti/i,
			id: 'aptitude',
			name: 'Aptitude',
		},
	];
	const usedSections = {};

	performance.mark('getReports_start');
	UserCache.get(id, (err, user) => {
		if (err) {
			res.json({ success: false, err });
		} else {
			const activePhases = getActivePhasesFromSubscriptions(user.subscriptions);
			Submission.find({ user: id }).then((submissions) => {
				const wrapperIds = submissions.map(
					(submission) => submission.assessmentWrapper
				);
				AssessmentTypeCache.getMany(wrapperIds, (err1, wrappers) => {
					if (err1) {
						res.json({ success: false, err1 });
					} else {
						const filteredWrappers = wrappers.filter((wrapper) => {
							if (
								!wrapper.type ||
								wrapper.type === 'TOPIC-MOCK' ||
								!wrapper.showInReports
							) {
								return false;
							}
							return true;
						});

						const sortedFilteredWrappers = sortWrappers(
							filteredWrappers,
							activePhases
						);

						const assessmentGroups = [];
						const analysisIds = [];
						const used = {};
						const testDetailsByAnalysisId = {};
						const wrappersById = {};
						sortedFilteredWrappers.forEach((wrapper) => {
							wrappersById[wrapper._id] = wrapper;
						});
						sortedFilteredWrappers.forEach((wrapper) => {
							if (!used[wrapper.analysis]) {
								if (wrapper.sequel || wrapper.prequel) {
									const sequelWrapper = wrapper.sequel
										? wrappersById[wrapper.sequel._id] || wrapper.sequel
										: wrapper;
									const prequelWrapper = wrapper.prequel
										? wrappersById[wrapper.prequel._id] || wrapper.prequel
										: wrapper;
									assessmentGroups.push([
										prequelWrapper.analysis,
										sequelWrapper.analysis,
									]);
									used[prequelWrapper.analysis] = true;
									used[sequelWrapper.analysis] = true;
									analysisIds.push(prequelWrapper.analysis, sequelWrapper.analysis);
									testDetailsByAnalysisId[prequelWrapper.analysis] = getTestDetails(
										prequelWrapper,
										activePhases
									);
									testDetailsByAnalysisId[sequelWrapper.analysis] = getTestDetails(
										sequelWrapper,
										activePhases
									);
								} else {
									assessmentGroups.push([wrapper.analysis]);
									used[wrapper.analysis] = true;
									analysisIds.push(wrapper.analysis);
									testDetailsByAnalysisId[wrapper.analysis] = getTestDetails(
										wrapper,
										activePhases
									);
								}
							}
						});

						WrapperStatsCache.getMany(analysisIds, (err2, wrapperStats) => {
							if (err2) {
								res.json({ success: false, err2 });
							} else {
								const submissionMap = {};
								submissions.forEach((s) => {
									submissionMap[s.wrapperAnalysis] = s;
								});

								const statsMap = {};
								const assessmentCoreIds = [];
								wrapperStats.forEach((ws) => {
									statsMap[ws._id] = ws;
									assessmentCoreIds.push(ws.core._id);
								});

								AssessmentCoreCache.getMany(
									assessmentCoreIds,
									(error, assessmentCores) => {
										if (error) {
											logger.info(
												`Failed to get data from AssessmentCoreCache: ${JSON.stringify(
													assessmentCoreIds
												)}`
											);
											next(new APIError('Internal server error', 500, true));
										} else {
											const assessmentCoresById = {};
											assessmentCores.forEach((core) => {
												assessmentCoresById[core._id] = core;
											});

											forEach(statsMap, (wrapperAnalysis, wrapperAnalysisId) => {
												const core = assessmentCoresById[wrapperAnalysis.core._id];
												statsMap[wrapperAnalysisId].maxMarks = {
													overall: getMaxMarks(core),
												};
												forEach(core.sections, (section) => {
													forEach(sectionConfigs, (sectionConfig) => {
														if (sectionConfig.regex.test(section.name)) {
															if (!usedSections[sectionConfig.id]) {
																usedSections[sectionConfig.id] = true;
															}
															statsMap[wrapperAnalysisId].maxMarks[sectionConfig.id] =
																getSecMaxMarks(section);
														}
													});
												});
											});

											if (newReport) {
												const items = createAssessmentGroupReport(
													statsMap,
													submissionMap,
													assessmentGroups,
													testDetailsByAnalysisId,
													sectionConfigs,
													user._id
												);
												res.json({
													items,
													sectionConfigs: [
														...sectionConfigs.filter((c) => usedSections[c.id]),
														{ id: 'overall', name: 'Overall' },
													],
												});
											} else {
												const report = createReport(
													statsMap,
													submissionMap,
													id,
													testDetailsByAnalysisId,
													assessmentGroups
												);
												res.json({ success: true, report });
											}
											performance.mark('getReports_end');
											performance.measure(
												'getReports',
												'getReports_start',
												'getReports_end'
											);
										}
									}
								);
							}
						});
					}
				});
			});
		}
	});
}

module.exports = {
	getReports,
};
