// routes/publicPaiementsRoutes.js
const express = require('express');
const router = express.Router();

const publicPaiementsController = require('../controllers/publicPaiementsController');

// POST /api/public/paiements/intention
router.post('/intention', publicPaiementsController.creerIntentionPaiement);

module.exports = router;
