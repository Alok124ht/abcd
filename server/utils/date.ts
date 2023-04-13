import dayjs from 'dayjs';

export const dateToStartTime = (
	date: Date | string | dayjs.Dayjs,
	returnType: 'date' | 'dayjs' | 'string' = 'date'
) => {
	const returnedDate = dayjs(date)
		.set('hour', 0)
		.set('minute', 0)
		.set('second', 0)
		.set('millisecond', 0);
	if (returnType === 'date') return returnedDate.toDate();
	else if (returnType === 'dayjs') return returnedDate;
	else return returnedDate.toString();
};

export const dateToEndTime = (
	date: Date | string | dayjs.Dayjs,
	returnType: 'date' | 'dayjs' | 'string' = 'date'
) => {
	const returnedDate = dayjs(date)
		.set('hour', 23)
		.set('minute', 59)
		.set('second', 59)
		.set('millisecond', 999);
	if (returnType === 'date') return returnedDate.toDate();
	if (returnType === 'dayjs') return returnedDate;
	return returnedDate.toString();
};

export const getStartOfYear = (
	returnType: 'date' | 'dayjs' | 'string' = 'date',
	year: string = dayjs().year().toString()
) => {
	const dateToReturn = dayjs(`01/01/${year}`)
		.set('hour', 0)
		.set('minute', 0)
		.set('second', 0)
		.set('millisecond', 0);
	if (returnType === 'date') return dateToReturn.toDate();
	if (returnType === 'string') return dateToReturn.toString();
	return dateToReturn;
};

export const getEndOfYear = (
	returnType: 'date' | 'dayjs' | 'string' = 'date',
	year: string = dayjs().year().toString()
) => {
	const dateToReturn = dayjs(`12/31/${year}`)
		.set('hour', 0)
		.set('minute', 0)
		.set('second', 0)
		.set('millisecond', 0);
	if (returnType === 'date') return dateToReturn.toDate();
	if (returnType === 'string') return dateToReturn.toString();
	return dateToReturn;
};

export const isValidDate = (dateObject: Date | string) => {
	return new Date(dateObject).toString() !== 'Invalid Date';
};
