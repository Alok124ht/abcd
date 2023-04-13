const fetch = require('node-fetch');

const Response = require('./response.model');

function iift(req, res) {
	const { email, phone, url } = req.body;

	// console.log('check url', url);

	fetch(url, {
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
		},
	})
		.then((response) => {
			if (response.ok) {
				response.text().then((body) => {
					const r = new Response({
						exam: 'IIFT',
						email,
						phone,
						body,
					});
					r.save()
						.then(() => {
							res.json({ success: true, body });
						})
						.catch(() => {
							res.json({ success: true, body });
						});
				});
			} else {
				res.json({ success: false });
			}
		})
		.catch(() => {
			res.json({ success: false });
		});
}

module.exports = {
	iift,
};

/*

const url =
		'

		https://cdn3.digialm.com///per/g28/pub/2083/touchstone/AssessmentQPHTMLMode1//2083O19230/2083O19230S1D1756/1575208094919834/DL0115101935_2083O19230S1D1756E1.html#

		';

*/
