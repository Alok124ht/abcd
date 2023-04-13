const Question = require('../../server/question/question.model').default;
const request = require('request');

const AWS = require('aws-sdk');
const fs = require('fs');

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

const getPolicy = (mime, headers, callback) => {
	// const {
	// 	payload: { role },
	// } = req;
	// if (role !== 'admin' && role !== 'super' && role !== 'moderator') {
	// 	res.status(401).send({ success: false, message: 'Unauthorized' });
	// 	return;
	// }
	const path = `qs/${getRandomFilename()}`;
	s3.createPresignedPost(
		{
			Bucket: process.env.AWS_QUESTION_DATA_BUCKET,
			Expires: 3600,
			Conditions: [{ key: path }],
			Fields: Object.assign({
				acl: 'public-read',
				key: path,
				'Cache-Control': 'max-age=31536000',
				mime,
			}),
			headers,
		},
		(error, policy) => callback(error, policy, path)
	);
};

const getContentEntityMapFromQuestion = (question) =>
	JSON.parse(question.content.rawContent).entityMap;

const imageSelectorRegex = /.*data:image\/.*/;

const getImageTypeAndContentFromDataUrl = (image) => {
	let imageType = '';
	let content = '';
	let isColonGone = false;
	let isSemiColorGone = false;
	let isCommaGone = false;
	for (let i = 0; i < image.length; i += 1) {
		const el = image[i];
		if (el === ':') {
			isColonGone = true;
		} else if (el === ';') {
			isSemiColorGone = true;
		} else if (el === ',') {
			isCommaGone = true;
		} else if (isCommaGone) {
			content += el;
		} else if (isSemiColorGone) {
			// its base 64
		} else if (isColonGone) {
			imageType += el;
		}
	}
	const array = [];
	for (let j = 0; j < content.length; j += 1) {
		array.push(content.charCodeAt(j));
	}
	const uIntArray = new Uint8Array(array);
	// const blob = new Blob([uIntArray], { type: imageType });
	return [imageType, uIntArray];
};
const uploadImageToS3 = (base64Image) =>
	new Promise((resolve, reject) => {
		const [mime] = getImageTypeAndContentFromDataUrl(base64Image);
		const data = base64Image.replace(/^data:image\/\w+;base64,/, '');
		const buf = new Buffer(data, 'base64');
		const fileName = `./setup/migrations/images/temp/${getRandomFilename()}.png`;
		fs.writeFile(fileName, buf, (error) => {
			if (error) {
				reject(error);
			} else {
				getPolicy(mime, { 'content-type': mime }, (_error, policy, path) => {
					if (_error) {
						reject(_error);
					} else {
						const finalUrl = `${policy.url}/${path}`;
						const formData = Object.assign({}, policy.fields, {
							file: fs.createReadStream(fileName),
							// 'content-type': mime,
						});
						// console.log(Object.assign({}, formData, {}), typeof image);
						// console.log('trying to upload image', { finalUrl });
						request.post({ url: policy.url, formData }, (__error) => {
							fs.unlink(fileName, () => {});
							if (__error) {
								reject(__error);
							} else {
								resolve(finalUrl);
							}
						});
					}
				});
				// resolve();
			}
		});
		// const mime = 'image/png';
		// const mime = 'binary/octet-stream';
		// const image = base64Image;
		// reject(new Error('Can not upload'));
	});

const replaceEntityMapOfQuestionAndGetQuestionRawContent = (
	question,
	newEntityMap
) => {
	const newQuestionRawContent = Object.assign(
		{},
		JSON.parse(question.content.rawContent),
		{ entityMap: newEntityMap }
	);
	return newQuestionRawContent;
};

const migrateQuestion = (question) => {
	return new Promise((resolve, reject) => {
		const entityMap = getContentEntityMapFromQuestion(question);
		// console.log('found entityMap', entityMap);
		const newEntityMap = Object.assign({}, entityMap);
		let countOfImagesToReplace = 0;
		let maxReplacableImages = 0;
		let didFail = false;
		const done = (error, entityKey, url) => {
			countOfImagesToReplace -= 1;
			if (error) {
				didFail += 1;
			} else {
				newEntityMap[entityKey].data.url = url;
			}
			if (countOfImagesToReplace === 0) {
				console.log({ didFail });
				if (maxReplacableImages > 0) {
					const newQuestionRawContent = replaceEntityMapOfQuestionAndGetQuestionRawContent(
						question,
						newEntityMap
					);
					question.set('content.rawContent', JSON.stringify(newQuestionRawContent));
					question.save((_ee) => {
						if (_ee) {
							resolve({ message: _ee.message, _id: question._id });
						} else {
							resolve({
								// newQuestionRawContent,
								// oldQuestionRawContent: JSON.parse(question.content.rawContent),
								_id: question._id,
								message: 'success',
							});
						}
					});
				} else {
					resolve({
						_id: question._id,
						message: 'No replacable images found in content',
					});
				}
			}
		};
		Object.keys(entityMap).forEach((entityKey) => {
			const entity = entityMap[entityKey];
			if (entity.type === 'IMAGE') {
				const dataURLImage = entity.data.url;
				if (!dataURLImage) {
					console.log('not dataURLImage', { entity });
				}
				countOfImagesToReplace += 1;
				maxReplacableImages += 1;
				// console.log(entity.data.url);
				uploadImageToS3(dataURLImage)
					.then((url) => {
						console.log('uploaded image to s3', url);
						done(null, entityKey, url);
					})
					.catch((e) => {
						console.error(e);
						console.log('failed to upload image to s3', e.message);
						done(e, entityKey);
					});
			}
		});
		if (countOfImagesToReplace === 0) {
			resolve({
				_id: question._id,
				message: 'No replacable images found in content',
			});
		}
	});
};

// const migrateQuestion = (question) => {
//     for image in all images of question
//     uploadImageToS3(image).then(url => {
//         replaceDataWithUrl()
//     })
// }

const listQuestionsWithImages = (req, res) => {
	const limit = req.query.limit;
	const onlyCount = req.query.onlyCount;
	const imageInQuestionQuery = { 'content.rawContent': imageSelectorRegex };
	const imageInSolution = { 'solution.rawContent': imageSelectorRegex };
	const imageInOptionQuery = {
		'options.content.rawContent': imageSelectorRegex,
	};
	if (onlyCount) {
		Question.countDocuments({ $or: [imageInQuestionQuery] }, (error, count) => {
			res.send({ error: error ? error.message : null, count });
		});
	} else {
		Question.find({
			$or: [imageInQuestionQuery],
		})
			.select('content.rawContent solution.rawContent options')
			.limit(parseInt(limit, 10))
			.exec((error, questions) => {
				if (error) {
					res.status(500).send({ message: error.message });
				} else {
					// res.send({ length: questions.length });
					Promise.all(questions.map((question) => migrateQuestion(question))).then(
						(_questions) => {
							res.send(_questions);
						}
					);
					// if (questions.length) {
					// 	migrateQuestion(questions[0]);
					// }
					// res.send(questions.map(questionMapper));
					// res.send(questions);
				}
			});
	}
};

module.exports = listQuestionsWithImages;
