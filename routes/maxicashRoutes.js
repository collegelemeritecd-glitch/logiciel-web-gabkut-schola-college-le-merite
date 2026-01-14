// routes/maxicashRoutes.js
const express = require('express');
const router = express.Router();
const maxicashController = require('../controllers/maxicashController');

router.get('/accept', maxicashController.handleAccept);
router.get('/decline', maxicashController.handleDecline);
router.get('/cancel', maxicashController.handleCancel);
router.get('/status', maxicashController.showStatusPage);

router.post('/', express.urlencoded({ extended: false }), maxicashController.handleNotify);
router.post('/notify', express.urlencoded({ extended: true }), maxicashController.handleNotify);

module.exports = router;
