import { UserRole } from '../../user/IUser';

const roleOrder = [
	UserRole.USER,
	UserRole.PARENT,
	UserRole.MENTOR,
	UserRole.LIBRARIAN,
	UserRole.EMPLOYEE,
	UserRole.HR,
	UserRole.INVENTORY_MANAGER,
	UserRole.ACCOUNT_STAFF,
	UserRole.MODERATOR,
	UserRole.ADMIN,
	UserRole.SUPER,
];

/**
 * Level of role must be at least requiredRole's level + levelDifference
 * indexOf(requiredRole)+levelDifference<=roleOrder[role]
 * @param requiredRole base role for comparision
 * @param role actual role of the user
 * @param levelDifference difference between requiredRole and role
 */
export const isAtLeast = (
	requiredRole: UserRole,
	role: UserRole | string,
	levelDifference: 0 | 1 = 0
) => {
	if (
		!roleOrder.includes(requiredRole) ||
		!roleOrder.includes(role) ||
		![0, 1].includes(levelDifference)
	) {
		return false;
	}
	const requiredRoleIndex = roleOrder.indexOf(requiredRole);
	const actualRoleIndex = roleOrder.indexOf(role);
	if (actualRoleIndex >= requiredRoleIndex + levelDifference) {
		return true;
	}
	return false;
};

export function isEqualOrBelow(maxRole: UserRole, role: UserRole | string) {
	const maxLevel = roleOrder.indexOf(maxRole);
	const actualLevel = roleOrder.indexOf(role);
	if (maxLevel <= 0) {
		// if max level doesn't exists in list
		return false;
	}
	return actualLevel <= maxLevel;
}

export const isAtLeastMentor = (role: UserRole | string) =>
	isAtLeast(UserRole.MENTOR, role) || role === 'super';

export const isAtLeastModerator = (role: UserRole | string) =>
	isAtLeast(UserRole.MODERATOR, role) || role === 'super';
