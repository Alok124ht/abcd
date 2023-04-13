const Leaderboard = require('./leaderboard.model');
const mongoose = require('mongoose');

const ObjectId = mongoose.Types.ObjectId;

function get(req, res) {
	// also for unauthorized users
	const {
		payload: { id },
	} = req;

	const { phase } = req.query;
	Leaderboard.findOne({ phase }, { ratings: 1 })
		.populate([{ path: 'ratings.user', select: '_id username dp' }])
		.then((leaderboard) => {
			if (leaderboard) {
				leaderboard.ratings.sort((a, b) => {
					if (b.rating > a.rating) return 1;
					else return -1;
				});

				let rank = -1;
				let percentile = -1;
				let rating_ = -1;
				leaderboard.ratings.forEach((rating, idx) => {
					if (rating.user._id.toString() == id.toString()) {
						rank = idx + 1;
						rating_ = rating.rating;
					}
				});

				if (rank !== -1) {
					percentile =
						Math.floor(
							(10000 * (leaderboard.ratings.length - rank)) /
								leaderboard.ratings.length
						) / 100.0;
				}

				res.json({
					success: true,
					leaderboard: leaderboard.ratings.splice(0, 10),
					rank,
					percentile,
					rating: Math.round(rating_),
				});
			} else {
				res.json({ success: false });
			}
		});
}

function getphaseleaderboard(req, res) {
	const { phase } = req.params;
	Leaderboard.findOne({ phase: phase }, { ratings: 1 })
		.populate([{ path: 'ratings.user', select: '_id username dp' }])
		.then((leaderboard) => {
			if (leaderboard) {
				leaderboard.ratings.sort((a, b) => {
					if (b.rating > a.rating) return 1;
					else return -1;
				});

				res.set('Cache-Control', 'public, s-maxage=3600');
				res.json({
					success: true,
					leaderboard: leaderboard.ratings.splice(0, 10),
				});
			} else {
				res.json({ success: false });
			}
		});
}

function getranks(req, res) {
	const {
		payload: { id },
	} = req;

	const { phase } = req.query;
	Leaderboard.findOne({ phase: phase }, { ratings: 1 }).then((leaderboard) => {
		if (leaderboard) {
			leaderboard.ratings.sort((a, b) => {
				if (b.rating > a.rating) return 1;
				else return -1;
			});

			let rank = -1;
			let percentile = -1;
			let rating_ = -1;
			leaderboard.ratings.forEach((rating, idx) => {
				if (rating.user._id.toString() == id.toString()) {
					rank = idx + 1;
					rating_ = rating.rating;
				}
			});

			if (rank !== -1) {
				percentile =
					Math.floor(
						(10000 * (leaderboard.ratings.length - rank)) / leaderboard.ratings.length
					) / 100.0;
			}

			res.json({
				success: true,
				rank,
				percentile,
				rating: Math.round(rating_),
			});
		} else {
			res.json({ success: false });
		}
	});
}

function getleaderboard(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}

	const { phase } = req.params;

	Leaderboard.findOne({ phase })
		.then((leaderboard) => {
			if (leaderboard) {
				res.json({ success: true, leaderboard });
			} else {
				res.json({ success: false, error: 'Leaderboard not found' });
			}
		})
		.catch(() => {
			res.json({ success: false, error: 'Mongo Error' });
		});
}

function getupdatelog(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}

	const { leaderboard, n } = req.body;

	Leaderboard.getupdatelog(leaderboard, n)
		.then((ul) => {
			res.json({ success: true, updatelog: ul });
		})
		.catch(() => {
			res.json({ success: false, error: 'Mongo Error' });
		});
}

function updateLeaderboard(req, res) {
	const {
		payload: { role },
	} = req;
	if (role !== 'admin' && role !== 'super') {
		res.json({ success: false });
		return;
	}

	const { phase } = req.query;

	Leaderboard.updateLeaderboard(ObjectId(phase), 0);

	res.json({ success: true, phase });

	// Leaderboard.getupdatelog(leaderboard, n)
	// 	.then((ul) => {
	// 		res.json({ success: true, updatelog: ul });
	// 	})
	// 	.catch(() => {
	// 		res.json({ success: false, error: 'Mongo Error' });
	// 	});
}

module.exports = {
	get,
	getphaseleaderboard,
	getranks,
	getleaderboard,
	getupdatelog,
	updateLeaderboard,
};
