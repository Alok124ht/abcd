const AWS = require('aws-sdk');

const s3 = new AWS.S3({
	region: process.env.AWS_QUESTION_DATA_REGION,
	accessKeyId: process.env.AWS_QUESTION_DATA_KEY_ID,
	secretAccessKey: process.env.AWS_QUESTION_DATA_ACCESS_KEY,
});

const getRandomFilename = () => {
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
	return makeid(40);
};

const getPolicy = (req, res) => {
	const {
		payload: { role },
	} = req;
	let isAdminOrModerator = false;

	if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
		isAdminOrModerator = true;
		// res.status(401).send({ success: false, message: 'Unauthorized' });
		// return;
	}
	const userId = req.payload.id;
	const randomFileSuffix = getRandomFilename();
	const fileName = isAdminOrModerator
		? randomFileSuffix
		: `u/${userId}/${randomFileSuffix}`;
	const path = `qs/${fileName}`;

	s3.createPresignedPost(
		{
			Bucket: process.env.AWS_QUESTION_DATA_BUCKET,
			Expires: 3600,
			Conditions: [{ key: path }],
			Fields: {
				acl: 'public-read',
				key: path,
			},
		},
		(error, policy) => {
			if (error) {
				res.status(500).send({ success: false, message: 'Some error occurred' });
				// eslint-disable-next-line no-console
				console.error(error);
			} else {
				res.send({ success: true, policy });
			}
		}
	);
};

module.exports = {
	getPolicy,
};
