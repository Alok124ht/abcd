const express = require('express');
const dbImagesController = require('./db_images.controller');

const router = express.Router(); // eslint-disable-line new-cap

router.route('/list_question_with_images_as_data').get(dbImagesController);
module.exports = router;
