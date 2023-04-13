import VaccineCenterResponseItem from '../types/VaccineCenterResponseItem';
import VaccineSessionResponseItem from '../types/VaccineSessionResponseItem';

export function fillEmptySessions(
	centers: VaccineCenterResponseItem[],
	allDates: string[]
): VaccineCenterResponseItem[] {
	// console.log(allDates);
	const filledCenters: VaccineCenterResponseItem[] = [];
	function createLike(
		sessionBase?: VaccineSessionResponseItem,
		forDate?: string
	) {
		const session: VaccineSessionResponseItem = {
			min_age_limit: 45,
			vaccine: '',
			...sessionBase,
			available_capacity: 0,
			date: forDate,
			slots: [],
		};
		return session;
	}
	centers.forEach((center) => {
		const datesMissed = allDates.filter(
			(date) => !center.sessions.some((session) => session.date === date)
		);
		// console.log(datesMissed);
		const baseSession = center.sessions[0];
		const allSessions = [...center.sessions];
		const filledSessions: VaccineSessionResponseItem[] = [];
		datesMissed.forEach((date) => {
			const session = createLike(baseSession, date);
			allSessions.push(session);
			filledSessions.push(session);
		});
		// console.assert(
		// 	allSessions.length === center.sessions.length,
		// 	`filled ${allSessions.length - center.sessions.length} missing session`,
		// 	filledSessions
		// );
		filledCenters.push({ ...center, sessions: allSessions });
	});
	return filledCenters;
}
