const VideoDraft = require('../models/VideoDraft');

const getDrafts = (req, res) => {
	const { id: userId } = req.payload;
	VideoDraft.find({ createdBy: userId }).exec((error, videoDrafts) => {
		if (error) {
			console.error(error);
			res.status(500).send({ message: 'Internal Server Error' });
			throw error;
		} else {
			res.send({ items: videoDrafts });
		}
	});
};

module.exports = { getDrafts };
