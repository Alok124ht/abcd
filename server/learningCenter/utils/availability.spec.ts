import assert from 'assert';
import moment from 'moment';
import { getAvailableFrom, getAvailableTill } from './availability';

describe('Playlist Item availability getter function', function () {
	it('Test Available From', function () {
		const now = moment();
		const availableFromDefault = now.toDate();
		const availableForPhase1 = now.clone().add(1, 'hour').toDate();
		const availableForPhase2 = now.clone().add(2, 'hours').toDate();
		const item = {
			availableFrom: now.toDate(),
			availableFromByPhase: {
				'1': availableForPhase1,
				'2': availableForPhase2,
			},
		};
		assert.equal(
			getAvailableFrom(item, ['1']).getTime(),
			availableForPhase1.getTime()
		);
		assert.equal(
			getAvailableFrom(item, ['2']).getTime(),
			availableForPhase2.getTime()
		);
		assert.equal(
			getAvailableFrom(item, ['random']).getTime(),
			availableFromDefault.getTime()
		);
	});
	it('Test Available Till', function () {
		const now = moment();
		const availableTillDefault = now.toDate();
		const availableForPhase1 = now.clone().add(1, 'hour').toDate();
		const availableForPhase2 = now.clone().add(2, 'hours').toDate();
		const item = {
			availableTill: now.toDate(),
			availableTillByPhase: {
				'1': availableForPhase1,
				'2': availableForPhase2,
			},
		};
		assert.equal(
			getAvailableTill(item, ['1']).getTime(),
			availableForPhase1.getTime()
		);
		assert.equal(
			getAvailableTill(item, ['2']).getTime(),
			availableForPhase2.getTime()
		);
		assert.equal(
			getAvailableTill(item, ['random']).getTime(),
			availableTillDefault.getTime()
		);
	});
	it('Test Available Till When not set by deafult', function () {
		const now = moment();
		const availableTillDefault = now.toDate();
		const availableForPhase1 = now.clone().add(1, 'hour').toDate();
		const availableForPhase2 = now.clone().add(2, 'hours').toDate();
		const item: {
			availableTill: Date;
			availableTillByPhase: {
				[phaseId: string]: Date;
			};
		} = {
			availableTill: null,
			availableTillByPhase: {
				'1': availableForPhase1,
				'2': availableForPhase2,
			},
		};
		assert.equal(
			getAvailableTill(item, ['1']).getTime(),
			availableForPhase1.getTime()
		);
		assert.equal(
			getAvailableTill(item, ['2']).getTime(),
			availableForPhase2.getTime()
		);
		assert.equal(getAvailableTill(item, ['random']), null);
	});
});
