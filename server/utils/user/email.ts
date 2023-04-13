import { get } from 'lodash';

export function getStrippedEmail(
	fullEmail: string,
	options?: { removeDots: boolean }
) {
	const removeDots = get(options, 'removeDots', true);
	if (typeof fullEmail !== 'string') {
		return fullEmail;
	}
	let strippedEmail = '';
	let isPlusSignOccurred = false;
	let hasAtOccurred = false;
	for (let i = 0; i < fullEmail.length; i += 1) {
		const c = fullEmail[i];
		if (c === '.') {
			if (hasAtOccurred || !removeDots) {
				strippedEmail += c;
			}
		} else if (c === '+') {
			isPlusSignOccurred = true;
		} else if (c === '@') {
			strippedEmail += c;
			isPlusSignOccurred = false;
			hasAtOccurred = true;
		} else if (c === ' ') {
			//
		} else if (!isPlusSignOccurred) {
			strippedEmail += c;
		}
	}
	return strippedEmail.toLowerCase();
}
