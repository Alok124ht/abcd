const VisitorUser = require('../models/VisitorUser');

const sourceEnumValues = VisitorUser.schema.path('source').enumValues;

const maxCookieAge = 60 * 24 * 60 * 60 * 1000;

const createVisitor = (req, res) => {
	const {
		cookies: { vid, auth },
		query: { source },
	} = req;
	if (auth) {
		res.send({ i: 'a' });
		return;
	}
	if (vid) {
		VisitorUser.find({ _id: vid })
			.select('user')
			.exec((error, visitor) => {
				if (error || !visitor) {
					// TODO: handle this
					// if vid is not in database or if database error occurres
					res.send({});
				} else {
					res.send({});
				}
			});
	} else if (!source) {
		res.send({});
	} else {
		const finalSource =
			sourceEnumValues.indexOf(source.toLowerCase()) > -1
				? source.toLowerCase()
				: 'unknown';
		const visitor = new VisitorUser({ source: finalSource });
		if (finalSource === 'unknown') {
			visitor.unknownSourceName = source;
		}
		visitor.save((saveError) => {
			if (saveError) {
				res.send({});
			} else {
				res.cookie('vid', visitor._id, { maxAge: maxCookieAge }).send({});
			}
		});
	}
};

module.exports = {
	createVisitor,
};
