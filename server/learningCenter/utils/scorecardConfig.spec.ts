import assert from 'assert';
import { ResourceType } from 'server/types/Playlist';
import {
	calculateGrades,
	generateScorecardConfig,
	Scorecard,
	ScorecardConfig,
	ScorecardShortConfig,
} from './scorecardConfig';

describe('Scorecard config generator testing', function () {
	const simpleShortConfig: ScorecardShortConfig = {
		label: 'Business',
		tagKey: 'Subject',
		tagValue: 'Business Acumen',
		tagLevel: 'Playlist',
		groupCreator: {
			tagKey: 'Topic',
			tagLevel: 'Resource',
			markingScheme: {
				// out of 100
				Assignment: 0,
				Attendance: 10,
				Overall: 90,
			},
		},
	};
	const itemsSimple = [
		{
			_id: 'ba1',
			resourceType: ResourceType.Video,
			tags: [
				{
					key: 'Topic',
					value: 'BA-T1',
				},
			],
			title: 'BA 1',
			playlist: {
				tags: [
					{
						key: 'Subject',
						value: 'Business Acumen',
					},
				],
				title: 'Hello World',
			},
		},
		{
			_id: 'ba2',
			resourceType: ResourceType.Video,
			tags: [
				{
					key: 'Topic',
					value: 'BA-T2',
				},
			],
			title: 'BA 2',
			playlist: {
				tags: [
					{
						key: 'Subject',
						value: 'Business Acumen',
					},
				],
				title: 'Hello World',
			},
		},
	];
	const generatedFullConfigSimple = generateScorecardConfig(
		itemsSimple,
		simpleShortConfig
	);
	const expectedFullConfigSimple: ScorecardConfig = {
		label: 'Business',
		tagKey: 'Subject',
		tagValue: 'Business Acumen',
		tagLevel: 'Playlist',
		maxMarks: 100,
		weightage: 1,
		groups: [
			{
				tagKey: 'Topic',
				tagValue: 'BA-T1',
				label: 'BA-T1',
				tagLevel: 'Resource',
				weightage: 0.5,
				maxMarks: 100,
				markingScheme: {
					Assignment: 0,
					Attendance: 10,
					Overall: 90,
				},
			},
			{
				tagKey: 'Topic',
				tagValue: 'BA-T2',
				label: 'BA-T2',
				tagLevel: 'Resource',
				weightage: 0.5,
				maxMarks: 100,
				markingScheme: {
					Assignment: 0,
					Attendance: 10,
					Overall: 90,
				},
			},
		],
	};
	it('Simple config', function () {
		assert.deepEqual(generatedFullConfigSimple, expectedFullConfigSimple);
	});
	it('A bit nested config', function () {
		const shortConfig: ScorecardShortConfig = {
			label: 'Technical',
			tagKey: 'Subject',
			tagValue: 'Technical Skills',
			tagLevel: 'Playlist',
			groupCreator: {
				tagLevel: 'Resource',
				tagKey: 'Topic',
				weightages: [
					{
						tagValue: 'SQL',
						// out of 100
						weightage: 20,
					},
					{
						tagValue: 'Tableau',
						weightage: 20,
					},
				],
				groupCreator: {
					tagKey: 'SubTopic',
					tagLevel: 'Resource',
					markingScheme: {
						// out of 100
						Assignment: 30,
						Attendance: 30,
						Projects: 35,
						'Mentor Assigned': 5,
					},
				},
			},
		};
		const items = [
			{
				_id: 'st1',
				resourceType: ResourceType.Video,
				tags: [
					{
						key: 'Topic',
						value: 'SQL',
					},
					{
						key: 'SubTopic',
						value: 'ST1',
					},
				],
				title: 'ST 1',
				playlist: {
					tags: [
						{
							key: 'Subject',
							value: 'Technical Skills',
						},
					],
					title: 'Hello World',
				},
			},
			{
				_id: 'tb1',
				resourceType: ResourceType.Video,
				tags: [
					{
						key: 'Topic',
						value: 'Tableau',
					},
					{
						key: 'SubTopic',
						value: 'TB1',
					},
				],
				title: 'TB 1',
				playlist: {
					tags: [
						{
							key: 'Subject',
							value: 'Technical Skills',
						},
					],
					title: 'Hello World',
				},
			},
			{
				_id: 'com1',
				resourceType: ResourceType.Video,
				tags: [
					{
						key: 'Topic',
						value: 'Communication',
					},
					{
						key: 'SubTopic',
						value: 'COM1',
					},
				],
				title: 'COM #1',
				playlist: {
					tags: [
						{
							key: 'Subject',
							value: 'Business Acumen',
						},
					],
					title: 'Hello World',
				},
			},
		];
		const generatedFullConfig = generateScorecardConfig(items, shortConfig);
		const expectedFullConfig: ScorecardConfig = {
			label: 'Technical',
			tagKey: 'Subject',
			tagValue: 'Technical Skills',
			tagLevel: 'Playlist',
			maxMarks: 100,
			weightage: 1,
			groups: [
				{
					label: 'SQL',
					tagKey: 'Topic',
					tagValue: 'SQL',
					tagLevel: 'Resource',
					maxMarks: 100,
					weightage: 0.5,
					groups: [
						{
							label: 'ST1',
							tagValue: 'ST1',
							tagKey: 'SubTopic',
							tagLevel: 'Resource',
							maxMarks: 100,
							weightage: 1,
							markingScheme: {
								Assignment: 30,
								Attendance: 30,
								Projects: 35,
								'Mentor Assigned': 5,
							},
						},
					],
				},
				{
					label: 'Tableau',
					tagKey: 'Topic',
					tagValue: 'Tableau',
					tagLevel: 'Resource',
					maxMarks: 100,
					weightage: 0.5,
					groups: [
						{
							label: 'TB1',
							tagValue: 'TB1',
							tagKey: 'SubTopic',
							tagLevel: 'Resource',
							maxMarks: 100,
							weightage: 1,
							markingScheme: {
								Assignment: 30,
								Attendance: 30,
								Projects: 35,
								'Mentor Assigned': 5,
							},
						},
					],
				},
			],
		};
		assert.deepEqual(generatedFullConfig, expectedFullConfig);
	});
	it('Calculate Grades', function () {
		if (Array.isArray(generatedFullConfigSimple)) {
			throw new Error('Generated full config simple should not be an array');
		}
		const expectedGradesSimple: Scorecard = {
			label: 'Business',
			score: 5,
			scoresByType: {
				Assignment: 0,
				Attendance: 5,
				Overall: 0,
			},
			children: [
				{
					label: 'BA-T1',
					score: 10,
					scoresByType: {
						Assignment: 0,
						Attendance: 10,
						Overall: 0,
					},
				},
				{
					label: 'BA-T2',
					score: 0,
					scoresByType: {
						Assignment: 0,
						Attendance: 0,
						Overall: 0,
					},
				},
			],
		};
		const grades = calculateGrades(
			itemsSimple,
			generatedFullConfigSimple,
			{
				ba1: {
					iw: true,
				},
			},
			{}
		);
		assert.deepEqual(grades, expectedGradesSimple);
	});
});
