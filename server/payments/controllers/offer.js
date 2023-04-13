const Offer = require('../../models/Offer').default;

const createOffer = (req, res) => {
	const { id: userId } = req.payload;
	const { startTime, endTime, items, usageLimit, discount } = req.body;
	const offer = new Offer({
		startTime,
		endTime,
		items,
		usageLimit,
		discount,
		createdBy: userId,
	});
	offer.save((saveError) => {
		if (saveError) {
			res
				.status(422)
				.send({ message: 'Failed to create offer', error: saveError });
		} else {
			res.send({ offer });
		}
	});
};

const getOffers = (req, res) => {
	const { id: userId } = req.payload;
	Offer.find({ createdBy: userId })
		.populate('items.value')
		.find((searchError, offers) => {
			if (searchError) {
				res.status(500).send({ message: 'Internal Server Error' });
			} else {
				res.send({ offers });
			}
		});
};

const updateOffer = (req, res) => {
	const { id: userId } = req.payload;
	const { _id, startTime, endTime, items, usageLimit, discount } = req.body;
	Offer.findOne({ _id, createdBy: userId }).exec((searchError, offer) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else if (!offer) {
			res.status(404).send({ message: 'Offer not found' });
		} else {
			offer.set('startTime', startTime);
			offer.set('endTime', endTime);
			offer.set('items', items);
			offer.set('usageLimit', usageLimit);
			offer.set('discount', discount);
			offer.save((saveError) => {
				if (saveError) {
					res
						.status(422)
						.send({ message: 'Failed to update offer', error: saveError });
				} else {
					res.send({ offer });
				}
			});
		}
	});
	// const offer = new Offer({ startTime, endTime, items, usageLimit, discount });
};

module.exports = { createOffer, getOffers, updateOffer };
