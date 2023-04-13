import { getRandomString } from './string';
import assert from 'assert';

describe('Random String', function () {
	it('Verify string length', () => {
		for (var i = 0; i < 20; i += 1) {
			const randomlyGeneratedString = getRandomString(i);
			assert.equal(randomlyGeneratedString.length, i);
		}
	});
	it('Verify no numbers when onlyAlphabets', () => {
		for (var i = 0; i < 20; i++) {
			const string = getRandomString(i, { onlyAlphabets: true });
			for (var j = 0; j < 10; j++) {
				const numIndex = string.includes(`${j}`);
				assert.equal(
					numIndex,
					false,
					`${string} contains numbers even when options.onlyAlphabets is true`
				);
			}
		}
	});
});
