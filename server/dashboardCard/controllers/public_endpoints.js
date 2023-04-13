const { map } = require('lodash');
const DashboardCard = require('../../models/DashboardCard');

const getCardsForPhase = (req, res) => {
	const phase = req.query.phase || req.params.phase;

	if (!phase) {
		res.send({ items: [] });
		return;
	}

	DashboardCard.find({
		$or: [{ phase }, { phases: phase }],
		isPublished: true,
	}).exec((searchError, dashboardCards) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else {
			res.send({
				items: map(dashboardCards, (card) => ({
					url: card.url,
					image: card.image,
					order: card.order,
					tags: card.tags,
					type: card.type,
				})),
			});
		}
	});
};

module.exports = { getCardsForPhase };
