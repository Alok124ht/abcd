const MentorshipType = require('../../models/Mentor/Type').default;
const { parseMongooseErrors } = require('../utils');

const getAllTypes = (req, res) => {
	const filters = req.query || {};
	const query = {};
	if (filters.isAvailable) {
		// eslint-disable-next-line eqeqeq
		query.available = filters.isAvailable == 1;
	}
	MentorshipType.find(query, (searchError, types) => {
		res.send({ items: types });
	});
};
const getTypes = (req, res) => {
	MentorshipType.find({ available: true }, (searchError, types) => {
		if (searchError) {
			res.status(500).send({
				message: 'Some error occurred while searching',
			});
		} else {
			res.send({ items: types });
		}
	});
	// res.send(getAllCategories());
};
const createType = (req, res) => {
	const { data } = req.body;
	const type = new MentorshipType(data);
	type.save((error, savedType) => {
		if (error) {
			console.error(error);
			res.status(422).send({ message: 'Some error occurred' });
		} else {
			res.send({ savedType });
		}
	});
};

const updateType = (req, res) => {
	const { data } = req.body;
	MentorshipType.findById(data._id, (searchError, type) => {
		type.set(data);
		type.save((saveError) => {
			if (saveError) {
				res.status(422).send({
					message: 'Some error occurred',
					errors: parseMongooseErrors(saveError),
				});
			} else {
				res.send({ type });
			}
		});
	});
};

module.exports = { getAllTypes, createType, updateType, getTypes };
