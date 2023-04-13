import { includes, toLower } from 'lodash';
import { VaccineCenter } from '../models/VaccineCenter';

export function getDisplayableName(
	center: VaccineCenter,
	forSMS = false,
	charLimit = -1
) {
	let n = center.name;
	if (center.blockName) {
		if (!includes(toLower(center.blockName), 'applicable')) {
			n += `, ${center.blockName}`;
		}
	}
	if (forSMS) {
		if (n.length > charLimit) {
			return n.substring(0, charLimit);
		}
		return n;
	}
	if (center.district && center.district.name) {
		n += `, ${center.district.name}`;
	}
	return n;
}
