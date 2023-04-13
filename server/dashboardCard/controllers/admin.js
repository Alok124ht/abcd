const DashboardCard = require('../../models/DashboardCard');
const config = require('../config');

const createCard = (req, res) => {
	const { id: userId } = req.payload;
	const { url, image, phase, phases, isPublished, order, tags, type } = req.body;
	const dashboardCard = new DashboardCard({
		url,
		image,
		phase,
		phases,
		createdBy: userId,
		isPublished,
		order,
		tags,
		type,
	});
	dashboardCard.save((saveError) => {
		if (saveError) {
			res
				.status(422)
				.send({ message: 'Error occurred while saving', error: saveError });
		} else {
			res.send({ dashboardCard });
		}
	});
};

const getCards = (req, res) => {
	const { phases } = res.locals;
	const { id: userId, role } = req.payload;
	const query = {};
	if (role !== 'super') {
		query.$or = [
			{
				phases: {
					$elemMatch: {
						$in: phases,
					},
				},
			},
			{ createdBy: userId },
		];
	}
	DashboardCard.find(query)
		.sort({ createdAt: -1 })
		.populate({ path: 'phases', select: 'name' })
		.exec((searchError, dashboardCards) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.send({ dashboardCards });
			}
		});
};

const getConfig = (req, res) => {
	res.send(config);
};

const updateCard = (req, res) => {
	const { id: userId, role } = req.payload;
	const {
		_id,
		url,
		image,
		phase,
		phases,
		isPublished,
		order,
		tags,
		type,
	} = req.body;

	const query = {
		_id,
	};
	if (role !== 'super') {
		query.$or = [
			{
				phases: {
					$elemMatch: {
						$in: phases,
					},
				},
			},
			{ createdBy: userId },
		];
	}
	DashboardCard.findOne(query).exec((searchError, dashboardCard) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!dashboardCard) {
			res.status(404).send({ message: 'Not found' });
		} else {
			dashboardCard.set('url', url);
			dashboardCard.set('image', image);
			dashboardCard.set('phase', phase);
			dashboardCard.set('isPublished', isPublished);
			dashboardCard.set('phases', phases);
			dashboardCard.set('order', order);
			dashboardCard.set('tags', tags);
			dashboardCard.set('type', type);
			dashboardCard.save((saveError) => {
				if (saveError) {
					res
						.status(500)
						.send({ message: 'Error occurred while saving', error: saveError });
				} else {
					res.send({ dashboardCard });
				}
			});
		}
	});
};

module.exports = { createCard, getCards, getConfig, updateCard };
