/* eslint-disable new-cap */
const express = require('express');
const auth = require('../middleware/auth').default;
const phaseMiddleware = require('../phase/middlewares');
const {
	createCard,
	getCards,
	getConfig,
	updateCard,
} = require('./controllers/admin');
const { getCardsForPhase } = require('./controllers/public_endpoints');

const isModerator = auth.createRoleValidator('moderator');
const router = express.Router();

router.route('/').get(getCardsForPhase);

const adminRouter = express.Router();
adminRouter.use(auth.required, isModerator);

adminRouter
	.route('/')
	.post(createCard)
	.get(phaseMiddleware.withPhases, getCards)
	.patch(updateCard);
adminRouter.route('/config').get(getConfig);

router.use('/admin', adminRouter);

router.route('/:phase').get(getCardsForPhase);

module.exports = router;
