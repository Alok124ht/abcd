const AWS = require('aws-sdk');
const Avatars = require('@dicebear/avatars').default;
const sprites = require('@dicebear/avatars-bottts-sprites').default;
const request = require('request');
const User = require('./user.model').default;

const s3 = new AWS.S3({
	region: process.env.AVATAR_S3_AWS_REGION,
	accessKeyId: process.env.AVATAR_S3_ACCESS_KEY_ID,
	secretAccessKey: process.env.AVATAR_S3_SECRET_ACCESS_KEY,
});

const getFilename = () => {
	function makeid(length) {
		let result = '';
		const characters =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		const charactersLength = characters.length;
		for (let i = 0; i < length; i += 1) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));
		}
		return result;
	}
	return makeid(10);
};

function getFileExtension(mime) {
	if (typeof mime !== 'string') {
		return '.jpg';
	}
	const secondHalf = mime.split('/')[1];
	if (secondHalf.includes('svg')) {
		return '.svg';
	}
	return `.${secondHalf}`;
}

const getPolicyForAvatar = (userId, mime, headers, callback) => {
	const extension = getFileExtension(mime);
	const filePath = `u/${userId}/${getFilename()}${extension}`;
	return s3.createPresignedPost(
		{
			Bucket: process.env.AVATAR_S3_BUCKET,
			Expires: 3600,
			Conditions: [{ key: filePath }],
			Fields: Object.assign(
				{
					acl: 'public-read',
					'Cache-Control': 'max-age=31536000',
					key: filePath,
					mime,
				},
				headers
			),
		},
		(err, data) => callback(err, data, filePath)
	);
};

const getPolicyAvatarUpload = (req, res) => {
	const { id: userId } = req.payload;
	const { mime } = req.query;
	getPolicyForAvatar(
		userId,
		mime,
		{ 'content-type': mime },
		(err, data, filePath) => {
			const attachment = { data, filePath };
			res.send({ attachment });
		}
	);
};

const updateAvatarForUser = (user, url) => {
	user.set('dp', url);
	user.save();
};

const updateAvatar = (req, res) => {
	const { id: userId } = req.payload;
	const { url } = req.body;
	User.findById(userId, (err, user) => {
		updateAvatarForUser(user, url);
		res.send({ success: true, user: user.toObject() });
	});
};

const uploadAvatarInBackground = (user, propSeed) => {
	let seed = propSeed;
	if (!seed) {
		seed = user._id;
	}
	const mime = 'image/svg+xml';
	getPolicyForAvatar(
		user._id,
		mime,
		{ 'content-type': mime },
		(err, data, filePath) => {
			const avatars = new Avatars(
				sprites({
					topChange: 0,
					sidesChance: 50,
					mouthChance: 0,
					textureChance: 0,
				})
			);
			const svg = avatars.create(seed);
			const formData = Object.assign({}, data.fields, { file: svg });
			request.post({ url: data.url, formData });

			// console.log('check user', user);

			User.update(
				{ _id: user._id },
				{ $set: { dp: `${data.url}/${filePath}` } }
			).exec();

			// user.set('dp', `${data.url}/${filePath}`);
			// user.save();
		}
	);
};

const getTemp = (req, res) => {
	res.send({ success: true });
};

module.exports = {
	getPolicyAvatarUpload,
	updateAvatar,
	getTemp,
	uploadAvatarInBackground,
};
