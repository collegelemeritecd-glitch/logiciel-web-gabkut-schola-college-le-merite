/************************************************************
 📘 GABKUT SCHOLA - ROUTES ADMIN FINANCE
*************************************************************/

const express = require('express');
const router = express.Router();

const adminFinanceController = require('../controllers/adminFinanceController');
// éventuellement middleware d’auth admin
// const { requireAdmin } = require('../middleware/auth');

// Dernières opérations financières
router.get(
  '/finance/last-operations',
  // requireAdmin,
  adminFinanceController.getLastOperations
);

// Encaissements mensuels (graphe bar)
router.get(
  '/finance/mensuel',
  // requireAdmin,
  adminFinanceController.getFinanceMensuelle
);

// Évolution journalière (10 derniers jours)
router.get(
  '/finance/evolution-jours',
  // requireAdmin,
  adminFinanceController.getEvolutionJours
);

// Répartition par modes de paiement (doughnut)
router.get(
  '/finance/modes',
  // requireAdmin,
  adminFinanceController.getModesPaiementDashboard
);

module.exports = router;

console.log('routes/adminFinanceRoutes.js chargé');
