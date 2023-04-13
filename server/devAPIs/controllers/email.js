const { ses } = require('../../utils/mail');

const sendTestEmail = (req, res) => {
	const params = {
		Content: {
			Simple: {
				Body: {
					Html: {
						Data: `
                            <div>
                                <h3>Hi Amit</h3>
                                <div>
                                    As you requested, you have been enrolled for CAT Crash Course.
                                </div>
                                <div>
                                    Please visit <a href="https://www.prepleaf.com/faq">FAQ<a> for more info.
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
			ToAddresses: ['asaharan812@gmail.com'],
		},
		FromEmailAddress: 'Prepleaf Support<support@prepleaf.com>',
	};
	ses.sendEmail(params, (error, data) => {
		if (error) {
			console.error(error);
			res.send({ type: 'Error occurred', message: error.message });
		} else {
			res.send({ data });
		}
	});
};
module.exports = { sendTestEmail };
