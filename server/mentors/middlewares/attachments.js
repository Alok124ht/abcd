const Attachment = require('../../models/Mentor/Attachment');

const hasEqualOrUpperPermission = (
	requiredPermission,
	permissionOnDocument
) => {
	switch (requiredPermission) {
		case 'view':
			return true;
		case 'comment':
			return permissionOnDocument === 'comment';
		default:
			return false;
	}
};

const userHasPermission = (attachment, userId, permission) => {
	// eslint-disable-next-line
	if (attachment.createdBy.equals(userId)) {
		return true;
	} else if (!attachment.permissions || !attachment.permissions.users) {
		return false;
	} else if (
		attachment.permissions.users.some(
			(p) =>
				p.user.equals(userId) && hasEqualOrUpperPermission(permission, p.permission)
		)
	) {
		return true;
	}
	return false;
};

const createHasPermissoinToAttachment = (permission) => (req, res, next) => {
	let { attachment: attachmentId } = req.body;
	if (!attachmentId) {
		attachmentId = req.query.attachment;
	}
	const { id: userId } = req.payload;
	const noPermissionMessage =
		"Either this attachment doesn't exist or you don't have permission to it.";
	Attachment.findById(attachmentId, (error, attachment) => {
		if (error || !attachment) {
			res.status(403).send({ message: noPermissionMessage });
		} else if (userHasPermission(attachment, userId, permission)) {
			res.locals.attachment = attachment;
			next();
		} else {
			res.status(403).send({ message: noPermissionMessage });
		}
	});
};

module.exports = {
	hasViewPermission: createHasPermissoinToAttachment('view'),
	hasCommentPermission: createHasPermissoinToAttachment('comment'),
};
