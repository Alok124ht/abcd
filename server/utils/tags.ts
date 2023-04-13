import { Tag } from '../types/Tag';
const spaceReplaceRegex = /\s\s+/g;

export function getTagValueByKey(tags: Tag[], tagKey: string): string {
	let tagValue: string = null;
	try {
		tags.some((tag) => {
			if (
				tag.key.trim().replace(spaceReplaceRegex, ' ').toLowerCase() ===
				tagKey.trim().replace(spaceReplaceRegex, ' ').toLowerCase()
			) {
				tagValue = tag.value;
				return true;
			}
			return false;
		});
	} catch (e) {}
	return tagValue;
}
