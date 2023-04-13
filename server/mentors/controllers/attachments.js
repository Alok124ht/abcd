const AWS = require('aws-sdk');
const AttachmentComment = require('../../models/Mentor/AttachmentComment');
const Attachment = require('../../models/Mentor/Attachment');
const { parseMongooseErrors } = require('../utils');
const { notifyUsers } = require('../../utils/socket');

const s3 = new AWS.S3({
	region: process.env.AWS_REGION,
	accessKeyId: process.env.AVATAR_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AVATAR_S3_SECRET_ACCESS_KEY,
});

const getFilename = () => {
	function makeid(length) {
		let result = '';
		const characters =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const charactersLength = characters.length;
		// eslint-disable-next-line
		for (let i = 0; i < length; i = i + 1) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	}
	return makeid(10);
};

const createPolicy = ({
	name,
	mime,
	path,
	thumbnail,
	userId,
	s3BucketName,
	s3Region,
	s3Instance,
}) =>
	new Promise((resolve) => {
		s3Instance.createPresignedPost(
			{
				Bucket: s3BucketName,
				Expires: 3600,
				Conditions: [{ key: path }],
				Fields: {
					acl: 'public-read',
					key: path,
					mime,
				},
			},
			(thumbnailErr, data) => {
				if (thumbnailErr) {
					resolve(null);
				} else {
					const attachment = new Attachment({
						bucketName: s3BucketName,
						region: s3Region,
						path,
						name,
						url: `${data.url}/${path}`,
						mime,
						createdBy: userId,
						thumbnail,
					});
					attachment.save((error, savedAttachment) => {
						if (error) {
							resolve(null);
						} else {
							resolve({
								data,
								filePath: path,
								id: savedAttachment._id,
							});
						}
					});
				}
			}
		);
	});

const getPolicyForAttachmentUpload = (req, res) => {
	const { id: userId } = req.payload;
	const {
		name,
		mime,
		thumbnailMime,
		requireThumbnail,
		thumbnailSuffix,
	} = req.query;
	const filePath = `user/${userId}/attachments/${getFilename()}-${name}`;
	const thumbnailPath = `user/${userId}/thumbnails/${getFilename()}-${name}${thumbnailSuffix}`;
	const createAttachment = (thumbnail) => {
		const filePromise = createPolicy({
			name,
			path: filePath,
			mime,
			userId,
			s3Instance: s3,
			s3Region: process.env.AWS_REGION,
			s3BucketName: process.env.AVATAR_S3_BUCKET,
			thumbnail: thumbnail ? thumbnail.id : undefined,
		});

		filePromise.then((attachment) => {
			res.send({
				attachment,
				thumbnail,
			});
		});
	};
	if (requireThumbnail) {
		createPolicy({
			name,
			path: thumbnailPath,
			mime: thumbnailMime,
			userId,
			s3Instance: s3,
			s3Region: process.env.AWS_REGION,
			s3BucketName: process.env.AVATAR_S3_BUCKET,
			create: !!requireThumbnail,
		}).then(createAttachment);
	} else {
		createAttachment(null);
	}
};

const getAttachment = (req, res) => {
	res.send(res.locals.attachment);
};

const addCommentToAttachment = (req, res) => {
	const { content, attachment: attachmentId } = req.body;
	const { id: userId } = req.payload;
	const comment = new AttachmentComment({
		createdBy: userId,
		content,
		attachment: attachmentId,
	});
	Attachment.findById(attachmentId)
		.populate('groups')
		.exec((attachmentSearchError, attachment) => {
			if (attachmentSearchError || !attachment) {
				res.status(422).send({ message: 'Invalid attachment id' });
			} else {
				comment.save((errors, savedComment) => {
					if (errors) {
						res.status(422).send({
							errors: parseMongooseErrors(errors),
						});
					} else {
						attachment.comments.push(attachment);
						attachment.save((error) => {
							if (error) {
								res.status(500).send({
									message: 'Error occurred while saving comment for attachment',
								});
							} else {
								res.send({ comment: savedComment });
								const users = [];
								attachment.groups.forEach((group) => {
									group.members.forEach((member) => {
										users.push(member);
									});
								});
								notifyUsers(users, 'attachment-comment-update', {
									attachmentId: attachment._id.toString(),
								});
							}
						});
					}
				});
			}
		});
};

const getAttachmentComments = (req, res) => {
	AttachmentComment.find(
		{ attachment: res.locals.attachment._id },
		(error, comments) => {
			if (error) {
				res.status(500).send({
					error: 'Unexpected error occurred. Please try again after some time',
				});
			} else {
				res.send({ comments });
			}
		}
	);
};

module.exports = {
	getPolicyForAttachmentUpload,
	getAttachment,
	addCommentToAttachment,
	getAttachmentComments,
};
