import { forEach, includes } from 'lodash';
import moment from 'moment';

function getDate(
	item: {
		date?: Date;
		datesByPhases: {
			[phaseId: string]: Date;
		};
	},
	phases: string[],
	selectionType: 'min' | 'max'
): Date {
	const selectedDates: Date[] = [];
	forEach(item.datesByPhases, (date, phase) => {
		if (includes(phases, phase)) {
			selectedDates.push(date);
		}
	});
	if (selectedDates.length) {
		return moment[selectionType](...selectedDates.map((d) => moment(d))).toDate();
	}
	return item.date;
}

export function getAvailableFrom(
	item: {
		availableFrom: Date;
		availableFromByPhase: { [phaseId: string]: Date };
	},
	phases: string[]
) {
	return getDate(
		{ date: item.availableFrom, datesByPhases: item.availableFromByPhase },
		phases,
		'min'
	);
}

export function getAvailableTill(
	item: {
		availableTill: Date;
		availableTillByPhase: { [phaseId: string]: Date };
	},
	phases: string[]
) {
	return getDate(
		{ date: item.availableTill, datesByPhases: item.availableTillByPhase },
		phases,
		'min'
	);
}
