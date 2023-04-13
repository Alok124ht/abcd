import {
	Playlist,
	PlaylistWithItemAndResourcePopulated,
	ResourceType,
} from '../../types/Playlist';
import { getTagValueByKey } from '../../utils/tags';
import { TagList } from '../../types/Tag';
import { ResourceBase } from '../models/ResourceBaseSchema';
import { UserVideoStat } from 'server/types/UserVideoStat';
import { AssignmentSubmissionDocument } from 'server/assignment/types/AssignmentSubmission';
import { AssignmentDocument } from 'server/assignment/types/Assignment';
import { forEach, reduce } from 'lodash';

interface ScorecardConfigBase {
	label: string;
	tagLevel: TagLevel;
	tagKey: string;
	tagValue: string;
	maxMarks: number;
	weightage: number;
}

type ScorecardMarkingScheme = {
	Assignment: number;
	Attendance: number;
	[customKey: string]: number;
};

interface ScorecardLeafConfig extends ScorecardConfigBase {
	markingScheme: ScorecardMarkingScheme;
}

export interface ScorecardConfig extends ScorecardConfigBase {
	groups: (ScorecardConfig | ScorecardLeafConfig)[];
}

type TagLevel = 'Playlist' | 'Resource';

type Weightage = { tagValue: string; weightage: number };

export interface ScorecardShortConfig {
	tagKey?: string;
	tagLevel?: TagLevel;
	label?: string;
	tagValue?: string;
	markingScheme?: ScorecardMarkingScheme;
	groupCreator?: ScorecardShortConfig;
	groups?: ScorecardShortConfig;
	maxMarks?: number;
	weightages?: Weightage[];
	/**
	 * Used when tagValue is specified
	 */
	weightage?: number;
}

function getTagValue(
	item: { title: string; tags: TagList; playlist: { tags: TagList } },
	tagKey: string,
	tagLevel: TagLevel
) {
	const tags = tagLevel === 'Playlist' ? item.playlist.tags : item.tags;
	return getTagValueByKey(tags, tagKey);
}

type CategorisableItem = Pick<ResourceBase, 'tags' | 'title'> &
	Partial<Pick<AssignmentDocument, 'maxMarks'>> & {
		_id: string;
		playlist: Pick<Playlist, 'tags' | 'title'>;
		resourceType: Playlist['resourceType'];
	};

export function getCategorisableItems(
	playlists: PlaylistWithItemAndResourcePopulated[]
) {
	const items: CategorisableItem[] = [];
	playlists.forEach((playlist) => {
		playlist.items.forEach((item) => {
			if (!item || !item.resource) {
				return;
			}
			if (playlist.resourceType === 'Assignment') {
				const assignment = item.resource as AssignmentDocument;
				items.push({
					_id: assignment._id.toString(),
					tags: assignment.tags,
					title: assignment.title,
					resourceType: playlist.resourceType,
					maxMarks: assignment.maxMarks,
					playlist: {
						tags: playlist.tags,
						title: playlist.title,
					},
				});
			} else {
				const resource = item.resource;
				items.push({
					_id: resource._id,
					tags: resource.tags,
					title: resource.title,
					resourceType: playlist.resourceType,
					playlist: {
						tags: playlist.tags,
						title: playlist.title,
					},
				});
			}
		});
	});
	return items;
}

export function generateScorecardConfig(
	categorisableItems: CategorisableItem[],
	shortConfig: ScorecardShortConfig
):
	| ScorecardConfig
	| ScorecardLeafConfig
	| (ScorecardConfig | ScorecardLeafConfig)[] {
	if (shortConfig.tagValue) {
		const itemsToConsider = categorisableItems.filter((item) => {
			const itemTagValue = getTagValue(
				item,
				shortConfig.tagKey,
				shortConfig.tagLevel
			);
			return itemTagValue === shortConfig.tagValue;
		});

		const distinctTags: string[] = [];
		itemsToConsider.forEach((item) => {
			const itemTagValue = getTagValue(
				item,
				shortConfig.tagKey,
				shortConfig.tagLevel
			);
			if (!distinctTags.includes(itemTagValue)) {
				distinctTags.push(itemTagValue);
			}
		});
		const groupBase: Omit<ScorecardConfig, 'groups' | 'markingScheme'> = {
			label: shortConfig.label || shortConfig.tagValue,
			tagKey: shortConfig.tagKey,
			tagValue: shortConfig.tagValue,
			tagLevel: shortConfig.tagLevel,
			maxMarks: shortConfig.maxMarks || 100,
			weightage:
				typeof shortConfig.weightage !== 'number' ? 1 : shortConfig.weightage,
		};

		if (shortConfig.groupCreator) {
			const subGroups = generateScorecardConfig(
				itemsToConsider,
				shortConfig.groupCreator
			);

			if (Array.isArray(subGroups)) {
				const group: ScorecardConfig = {
					...groupBase,
					groups: subGroups,
				};
				return group;
			} else {
				throw new Error('Sub groups should be an array but it is not an array');
			}
		} else {
			// leaf node
			const group: ScorecardLeafConfig = {
				...groupBase,
				markingScheme: shortConfig.markingScheme,
			};
			return group;
		}
	} else {
		/**
		 * Find all the tagValues and return an array
		 */
		const matchingItems: CategorisableItem[] = [];
		const distinctTags: string[] = [];
		categorisableItems.forEach((item) => {
			const itemTagValue = getTagValue(
				item,
				shortConfig.tagKey,
				shortConfig.tagLevel
			);
			if (!itemTagValue) {
				// if tag not set, reject it
				return;
			}
			matchingItems.push(item);
			if (!distinctTags.includes(itemTagValue)) {
				distinctTags.push(itemTagValue);
			}
		});
		let weightageMultiplier = 1 / distinctTags.length;
		const weightages =
			shortConfig.weightages ||
			distinctTags.map((tag) => ({
				weightage: weightageMultiplier,
				tagValue: tag,
			}));
		const totalWeight = weightages.reduce(
			(accu, current) => accu + current.weightage,
			0
		);
		return distinctTags.map((tag) => {
			let weight = 0;
			weightages.forEach(({ tagValue, weightage }) => {
				if (tagValue === tag) {
					weight = weightage / totalWeight;
				}
			});
			const groupBase: ScorecardShortConfig = {
				label: tag,
				tagValue: tag,
				tagKey: shortConfig.tagKey,
				tagLevel: shortConfig.tagLevel,
				maxMarks: shortConfig.maxMarks || 100,
				markingScheme: shortConfig.markingScheme,
				groupCreator: shortConfig.groupCreator,
				weightage: weight,
			};
			const categorizedItems = generateScorecardConfig(matchingItems, groupBase);
			if (Array.isArray(categorizedItems)) {
				throw new Error('Categorized items are array, expected them to be object');
			} else {
				return categorizedItems;
			}
		});
	}
}

export interface Scorecard {
	label: string;
	score: number;
	scoresByType: ScorecardMarkingScheme;
	children?: Scorecard[];
}

function calculateAssignmentScorePercentage(
	items: CategorisableItem[],
	submissionsByAssignment: {
		[assignmentId: string]: AssignmentSubmissionDocument;
	}
) {
	let userScore = 0,
		maxMarks = 0;
	items.forEach((item) => {
		maxMarks += item.maxMarks;
		if (submissionsByAssignment[item._id]) {
			userScore = submissionsByAssignment[item._id].grades.reduce(
				(accumulator, sectionGrade) => accumulator + sectionGrade.marks,
				0
			);
		}
	});

	if (typeof maxMarks !== 'number') {
		throw new Error('maxMarks should always be a number');
	}
	if (maxMarks === 0) {
		return 0;
	}

	return userScore / maxMarks;
}

function calculateAttendanceScorePercentage(
	items: CategorisableItem[],
	statsByVideo: { [videoId: string]: Pick<UserVideoStat, 'iw' | 'djl'> }
) {
	const totalItems = items.length;
	let attenddedCount = 0;
	items.forEach((item) => {
		if (
			statsByVideo[item._id] &&
			(statsByVideo[item._id].iw || statsByVideo[item._id].djl)
		) {
			attenddedCount += 1;
		}
	});
	if (totalItems === 0) {
		return 0;
	}
	return attenddedCount / totalItems;
}
const createBelongsToGroup = (group: ScorecardConfig | ScorecardLeafConfig) => {
	return (item: CategorisableItem) => {
		const itemTagValue = getTagValue(item, group.tagKey, group.tagLevel);
		return itemTagValue === group.tagValue;
	};
};

export function calculateGrades(
	items: CategorisableItem[],
	config: ScorecardConfig | ScorecardLeafConfig,
	statsByVideo: { [videoId: string]: Pick<UserVideoStat, 'iw' | 'djl'> },
	submissionsByAssignment: {
		[assignmentId: string]: AssignmentSubmissionDocument;
	}
): Scorecard {
	if ('groups' in config) {
		let totalScore = 0;
		let scoresByType: ScorecardMarkingScheme = {
			Assignment: 0,
			Attendance: 0,
		};
		const children = config.groups.map((group) => {
			const filteredItems = items.filter(createBelongsToGroup(group));
			const scorecard = calculateGrades(
				filteredItems,
				group,
				statsByVideo,
				submissionsByAssignment
			);
			totalScore += scorecard.score * group.weightage;
			forEach(scorecard.scoresByType, (score, type) => {
				if (!scoresByType[type]) {
					scoresByType[type] = 0;
				}
				scoresByType[type] += group.weightage * score;
			});
			return scorecard;
		}, 0);
		const scorecard: Scorecard = {
			label: config.label,
			score: totalScore,
			scoresByType,
			children: children,
		};
		return scorecard;
	} else {
		const { markingScheme } = config;

		let scoresByType: ScorecardMarkingScheme = {
			Assignment: 0,
			Attendance: 0,
		};
		forEach(markingScheme, (itemMarkingScheme, type) => {
			let percentMarksScored = 0;
			if (type === 'Assignment') {
				percentMarksScored = calculateAssignmentScorePercentage(
					items.filter((i) => i.resourceType === ResourceType.Assignment),
					submissionsByAssignment
				);
			} else if (type === 'Attendance') {
				percentMarksScored = calculateAttendanceScorePercentage(
					items.filter((i) => i.resourceType === ResourceType.Video),
					statsByVideo
				);
			}
			scoresByType[type] = itemMarkingScheme * percentMarksScored;
		});
		const totalScore = reduce(
			markingScheme,
			(accu, itemMarkingScheme, type) => accu + scoresByType[type],
			0
		);
		const scorecard: Scorecard = {
			label: config.label,
			score: totalScore,
			scoresByType,
		};
		return scorecard;
	}
}
