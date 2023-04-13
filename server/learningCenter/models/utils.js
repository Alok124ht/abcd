const { some } = require('lodash');

/**
 * Utility functions for models
 */

const getTagValueByKey = (tags, key) => {
	let value = null;
	some(tags, ({ key: _key, value: _value }) => {
		if (key === _key) {
			value = _value;
			return true;
		}
		return false;
	});
	return value;
};

const canShowContent = (hasAccessToContent, tags) =>
	hasAccessToContent || getTagValueByKey(tags, 'isPublic') === 'Yes';

module.exports = {
	canShowContent,
};
