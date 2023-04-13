import { Types } from 'mongoose';
import { Response } from 'express';
import { forEach, get } from 'lodash';
import AdminPermissionResponseLocal from '../../admin/permissions/types/AdminPermissionResponseLocal';

interface HasAccessToPhaseOptions {
	matchAll: boolean;
}

/**
 * This functions validates if a user has acecss to phases
 * @param phases Phases to match
 * @param res express res object, which may contain adminPermission and phases
 * @param options validation options, set matchAll to false if you want to allow user with access to at least one phase out of all phases
 * @returns if use has access or not
 */
export function adminHasAccessToPhases(
	phases: (Types.ObjectId | string)[],
	res: Response & {
		locals: {
			adminPermission?: AdminPermissionResponseLocal;
			phases?: (string | Types.ObjectId)[];
		};
	},
	options?: HasAccessToPhaseOptions
) {
	const matchAll = get(options, 'matchAll', true);
	const { adminPermission, phases: allowedPhasesByClient } = res.locals;
	const allPhases: Types.ObjectId[] = [];
	forEach(adminPermission.phases, (phase) => allPhases.push(phase));
	forEach(allowedPhasesByClient, (phase) => {
		if (typeof phase === 'string') {
			allPhases.push(Types.ObjectId(phase));
		} else {
			allPhases.push(phase);
		}
	});
	let someMatches = !phases.length;
	let allMatches = true;
	phases.forEach((phaseIdToMatch) => {
		if (allPhases.some((phaseId) => phaseId.equals(phaseIdToMatch))) {
			someMatches = true;
			return true;
		}
		allMatches = false;
		return false;
	});
	return matchAll ? allMatches : someMatches;
}

/**
 * This functions validates if a user has acecss to phases
 * @param phase Phase to match
 * @param res express res object, which may contain adminPermission and phases
 * @param options validation options, set matchAll to false if you want to allow user with access to at least one phase out of all phases
 * @returns if use has access or not
 */
export function adminHasAccessToPhase(
	phase: Types.ObjectId | string,
	res: Response & {
		locals: {
			adminPermission?: AdminPermissionResponseLocal;
			phases?: (string | Types.ObjectId)[];
		};
	}
) {
	return adminHasAccessToPhases([phase], res);
}
