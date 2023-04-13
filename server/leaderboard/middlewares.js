const isPhaseValidObjectId = (req, res, next) => {
	const { phase } = req.params;
	const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(phase); //when phase is not assigned, many invalid ids are there
	if (isValidObjectId) {
		next();
	} else {
		res
			.status(422)
			.send({ success: false, error: { code: 'phase-not-valid', phase } });
	}
};

const isPhaseValidObjectId2 = (req, res, next) => {
	const { phase } = req.query;
	const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(phase); //when phase is not assigned, many invalid ids are there
	if (isValidObjectId) {
		next();
	} else {
		res
			.status(422)
			.send({ success: false, error: { code: 'phase-not-valid', phase } });
	}
};

module.exports = {
	isPhaseValidObjectId,
	isPhaseValidObjectId2,
};
