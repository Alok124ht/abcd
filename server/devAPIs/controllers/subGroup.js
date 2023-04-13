const SubGroupCache = require('../../cache/Subgroup');

const getCachedSubGroup = (req, res) => {
	SubGroupCache.getWithPhases('5d10e49c44c6e111d0a17d10', (error, s) => {
		res.send({ s });
	});
};

module.exports = { getCachedSubGroup };
