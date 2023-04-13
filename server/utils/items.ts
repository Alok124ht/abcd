import { forEach, get } from 'lodash';

export function createItemsById<Item>(
	items: Item[],
	key?: string
): { [key: string]: Item } {
	const itemsById: { [key: string]: Item } = {};
	forEach(items, (item) => {
		const keyValue: string = get(item, [key]);
		itemsById[keyValue] = item;
	});
	return itemsById;
}
