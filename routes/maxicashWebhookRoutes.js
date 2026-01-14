// routes/maxicashWebhookRoutes.js
const express = require('express');
const router = express.Router();
const maxicashController = require('../controllers/maxicashController');

// Redirections utilisateur après paiement
router.get('/accept', maxicashController.handleAccept);
router.get('/decline', maxicashController.handleDecline);
router.get('/cancel', maxicashController.handleCancel);

// Webhook MaxiCash (notifyurl)
router.post('/', express.urlencoded({ extended: false }), maxicashController.handleNotify);

module.exports = router;
