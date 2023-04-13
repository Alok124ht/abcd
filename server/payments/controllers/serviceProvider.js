const RazorpayAccount = require('../../models/RazorpayAccount').default;
const ServiceProviders = require('../../models/ServiceProviders');

const createRazorpayAccount = (req, res) => {
	const { razorpayAccountId, percentageToTransfer, name } = req.body;
	const razorpayAccount = new RazorpayAccount({
		razorpayAccountId,
		percentageToTransfer,
		name,
	});
	razorpayAccount.save((error) => {
		if (error) {
			res.status(422).send({ message: 'Can not create', error });
		} else {
			res.send({ razorpayAccount });
		}
	});
};

const createServiceProviders = (req, res) => {
	const { items, service } = req.body;
	const { id: userId } = req.payload;

	const serviceProviders = new ServiceProviders({
		items,
		service,
		createdBy: userId,
	});
	serviceProviders.save((error) => {
		if (error) {
			res.status(422).send({ message: 'Unable to save', error });
		} else {
			res.send({ serviceProviders });
		}
	});
};

const getAllRazorpayAccounts = (req, res) => {
	RazorpayAccount.find({}).exec((searchError, razorpayAccounts) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else {
			res.send({ items: razorpayAccounts });
		}
	});
};

const getServiceProviders = (req, res) => {
	ServiceProviders.find({}).exec((searchError, serviceProvidersList) => {
		if (searchError) {
			res.status(500).send({ message: 'Internal Server Error' });
		} else {
			res.send({ serviceProvidersList });
		}
	});
};

module.exports = {
	createRazorpayAccount,
	createServiceProviders,
	getAllRazorpayAccounts,
	getServiceProviders,
};
