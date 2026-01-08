// routes/percepteurRoutes.js
const express = require('express');
const router = express.Router();
const percepteurClasseController = require('../controllers/percepteurClasseController');
const { authPercepteur } = require('../middlewares/auth');

router.get(
  '/classes/:id/detail',
  authPercepteur,
  percepteurClasseController.getClasseDetail
);

module.exports = router;
