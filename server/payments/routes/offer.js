const express = require('express');
const auth = require('../../middleware/auth').default;
const { createOffer, getOffers, updateOffer } = require('../controllers/offer');

// eslint-disable-next-line new-cap
const router = express.Router();

const isModerator = auth.createRoleValidator('moderator');

// eslint-disable-next-line new-cap
const adminRouter = express.Router();

adminRouter.use(auth.required, isModerator);

adminRouter.route('/').get(getOffers).post(createOffer).patch(updateOffer);

router.use('/admin', adminRouter);

module.exports = router;
