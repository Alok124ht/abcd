import chai from 'chai';
import lib from './lib';

const { convertXPToPaise } = lib;

const { expect } = chai;

describe('convertXPToPaise', () => {
	it('1 rupee should be equal to 4 xp', () => {
		expect(convertXPToPaise(4)).to.equal(100);
	});
});
