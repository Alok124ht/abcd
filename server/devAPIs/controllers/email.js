const { ses } = require('../../utils/mail');

const sendTestEmail = (req, res) => {
	const params = {
		Content: {
			Simple: {
				Body: {
					Html: {
						Data: `
                            <div>
                                <h3>Hi Meghal</h3>
                                <div>
                                    As you requested, you have been enrolled for CAT Crash Course.
                                </div>
                                <div>
                                    Please visit <a href="https://www.prepseed.com/faq">FAQ<a> for more info.
                                </div>
                            </div>
                        `,
						Charset: 'UTF-8',
					},
				},
				Subject: {
					Data: 'You have been enrolled in CAT Crash Course',
					Charset: 'UTF-8',
				},
			},
		},
		Destination: {
			ToAddresses: ['meghals0405@gmail.com'],
		},
		FromEmailAddress: 'Prepseed Helpline<help@prepseed.com>',
	};
	ses.sendEmail(params, (error, data) => {
		if (error) {
			console.error(error);
			res.send({ type: 'Error occurred', message: error.message, error });
		} else {
			res.send({ data });
		}
	});
};
module.exports = { sendTestEmail };
