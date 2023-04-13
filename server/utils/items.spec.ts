import assert from 'assert';
import { createItemsById } from './items';

describe('Create itemsById from array', () => {
	it('Create itemsById by key _id', () => {
		const items = [
			{
				_id: 'a',
				name: 'A',
			},
		];
		const expected = {
			a: items[0],
		};
		const itemsById = createItemsById(items, '_id');

		assert.deepEqual(itemsById, expected);
	});
});
