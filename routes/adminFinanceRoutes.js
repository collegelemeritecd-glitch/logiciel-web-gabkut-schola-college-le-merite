/************************************************************
 📘 GABKUT SCHOLA - ROUTES ADMIN FINANCE
 Lecture seule pour le dashboard admin
*************************************************************/

const express = require('express');
const router = express.Router();

const adminFinanceController = require('../controllers/adminFinanceController');

// Optionnel : middleware auth admin
// const { requireAdmin } = require('../middleware/auth');

// Dernières opérations financières
router.get(
  '/finance/last-operations',
  // requireAdmin,
  adminFinanceController.getLastOperations
);

// Encaissements mensuels (pour le graphique)
router.get(
  '/finance/mensuel',
  // requireAdmin,
  adminFinanceController.getFinanceMensuelle
);

module.exports = router;

console.log('routes/adminFinanceRoutes.js chargé');
