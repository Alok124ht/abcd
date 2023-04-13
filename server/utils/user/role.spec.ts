const assert = require('assert');
import { UserRole } from '../../user/IUser';
import { isAtLeast } from './role';

describe('Validate role comparision function', function () {
	it('return true for user with higher roles (with min difference 0)', function () {
		assert.equal(isAtLeast(UserRole.USER, UserRole.USER, 0), true);
		assert.equal(isAtLeast(UserRole.USER, UserRole.MENTOR, 0), true);
		assert.equal(isAtLeast(UserRole.USER, UserRole.MODERATOR, 0), true);
		assert.equal(isAtLeast(UserRole.USER, UserRole.ADMIN, 0), true);
		assert.equal(isAtLeast(UserRole.USER, UserRole.SUPER, 0), true);

		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.MENTOR, 0), true);
		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.MODERATOR, 0), true);
		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.ADMIN, 0), true);
		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.SUPER, 0), true);

		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.MODERATOR, 0), true);
		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.ADMIN, 0), true);
		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.SUPER, 0), true);

		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.ADMIN, 0), true);
		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.SUPER, 0), true);

		assert.equal(isAtLeast(UserRole.SUPER, UserRole.SUPER, 0), true);
	});

	it('return true for user with higher roles(with min difference 1)', function () {
		assert.equal(isAtLeast(UserRole.USER, UserRole.MENTOR, 1), true);
		assert.equal(isAtLeast(UserRole.USER, UserRole.MODERATOR, 1), true);
		assert.equal(isAtLeast(UserRole.USER, UserRole.ADMIN, 1), true);
		assert.equal(isAtLeast(UserRole.USER, UserRole.SUPER, 1), true);

		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.MODERATOR, 1), true);
		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.ADMIN, 1), true);
		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.SUPER, 1), true);

		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.ADMIN, 1), true);
		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.SUPER, 1), true);

		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.SUPER, 1), true);
	});

	it('return false for user with lower roles (with min difference 0)', function () {
		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.USER, 0), false);
		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.USER, 0), false);
		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.USER, 0), false);
		assert.equal(isAtLeast(UserRole.SUPER, UserRole.USER, 0), false);

		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.MENTOR, 0), false);
		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.MENTOR, 0), false);
		assert.equal(isAtLeast(UserRole.SUPER, UserRole.MENTOR, 0), false);

		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.MODERATOR, 0), false);
		assert.equal(isAtLeast(UserRole.SUPER, UserRole.MODERATOR, 0), false);

		assert.equal(isAtLeast(UserRole.SUPER, UserRole.ADMIN, 0), false);
	});

	it('return false for user with lower roles (with min difference 1)', function () {
		assert.equal(isAtLeast(UserRole.USER, UserRole.USER, 1), false);
		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.USER, 1), false);
		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.USER, 1), false);
		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.USER, 1), false);
		assert.equal(isAtLeast(UserRole.SUPER, UserRole.USER, 1), false);

		assert.equal(isAtLeast(UserRole.MENTOR, UserRole.MENTOR, 1), false);
		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.MENTOR, 1), false);
		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.MENTOR, 1), false);
		assert.equal(isAtLeast(UserRole.SUPER, UserRole.MENTOR, 1), false);

		assert.equal(isAtLeast(UserRole.MODERATOR, UserRole.MODERATOR, 1), false);
		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.MODERATOR, 1), false);
		assert.equal(isAtLeast(UserRole.SUPER, UserRole.MODERATOR, 1), false);

		assert.equal(isAtLeast(UserRole.ADMIN, UserRole.ADMIN, 1), false);
		assert.equal(isAtLeast(UserRole.SUPER, UserRole.ADMIN, 1), false);

		assert.equal(isAtLeast(UserRole.SUPER, UserRole.SUPER, 1), false);
	});

	it('return false for roles not in list', function () {
		assert.equal(isAtLeast('random', 'super', 0), false);
		assert.equal(isAtLeast('random', 'super', 1), false);
		assert.equal(isAtLeast(UserRole.USER, 'super', -1), false);
		assert.equal(isAtLeast('user', 'super', true), false);
	});
});
