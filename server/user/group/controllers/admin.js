const APIError = require('../../../helpers/APIError');
const UserGroup = require('../../../models/UserGroup').default;
const UserToUserGroup = require('../../../models/UserToUserGroup').default;

const getGroup = (req, res, next) => {
	const { userGroup: groupId } = req.query;
	const { client } = res.locals;
	const query = { _id: groupId };
	if (client) {
		query.client = client._id;
	}
	UserGroup.findOne(query, (searchError, userGroup) => {
		if (searchError) {
			next(new APIError('Could not search group', 500));
		} else if (!userGroup) {
			next(new APIError('Group not found', 404));
		} else {
			UserToUserGroup.find({ group: groupId })
				.select('user')
				.exec((groupItemSearchError, items) => {
					if (groupItemSearchError) {
						next(new APIError('Failed to search users of group', 500, true));
					} else {
						res.send({ ...userGroup.toObject(), userItems: items });
					}
				});
		}
	});
};

module.exports = {
	getGroup,
};
