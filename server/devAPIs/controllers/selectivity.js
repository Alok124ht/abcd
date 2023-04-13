const _ = require('lodash');
const Submission = require('../../assessment/submission.model').default;
const {
	calculateStaminaForSubmission,
} = require('../../utils/user/indexes/stamina');

const temp = (req, res) => {
	const limit = parseInt(req.query.limit, 10);
	const query = {};
	const submissionId = req.query.submissionId;
	const skip = _.isEmpty(req.query.skip) ? 0 : parseInt(req.query.skip, 10);
	if (submissionId) {
		query._id = submissionId;
	}
	const questionProps =
		'options multiOptions integerAnswer type content dataType link hint solution reports level';
	Submission.find(query)
		.limit(limit && !isNaN(limit) ? limit : 100)
		.skip(skip)
		.populate([
			{
				path: 'assessmentCore',
				populate: [
					{
						path: 'sections.questions.question',
						select: questionProps,
						populate: [{ path: 'statistics' }],
					},
				],
			},
		])

		.exec((error, submissions) => {
			if (error) {
				res
					.status(500)
					.send({ errorMessage: error.message, error: 'Internal server error' });
			} else if (!submissions || !submissions.length) {
				res.status(422).send({
					error: 'Invalid submission id',
					submissionId,
					query,
					body: req.body,
				});
			} else {
				// res.send({ submissions });
				// return;
				Promise.all(
					submissions.map(
						(submission) =>
							new Promise((resolve, reject) => {
								try {
									const stamina = calculateStaminaForSubmission(
										submission,
										submission.assessmentCore
									);
									resolve(stamina);
								} catch (e) {
									console.error(e);
									console.log(submission._id);
									resolve(-1);
								}
								// resolve();
							})
					)
				)
					.then((r) => {
						const countById = {};
						const m = r.filter((i) => typeof i === 'number').sort((a, b) => a - b);
						m.forEach((i) => {
							if (!countById[i]) {
								countById[i] = 0;
							}
							countById[i] += 1;
						});
						let s = '';
						_.forEach(countById, (value, key) => {
							s += `${key},${value}\n`;
						});
						res.send(s);
					})
					.catch((_error) => {
						res.status(500).send({
							message: _error.message,
							m: 'Some error occurred in Promise.all',
						});
					});
			}
		});
};
module.exports = { temp };
