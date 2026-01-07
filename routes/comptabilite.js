/************************************************************
 📘 ROUTES COMPTABILITÉ - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Middleware pour toutes les routes comptabilité
router.use(authMiddleware);
router.use(requireRole(['comptable', 'admin']));

// Dashboard
// router.get('/dashboard', comptableDashboardController.getDashboard);

// Journal comptable
// router.get('/journal', comptableJournalController.getJournal);

// Balance
// router.get('/balance', comptableBalanceController.getBalance);

// Rapports
// router.get('/rapports', comptableRapportsController.getRapports);

// Route temporaire pour tests
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes Comptabilité disponibles (en développement)',
    user: req.user
  });
});

module.exports = router;

console.log('✅ Routes Comptabilité chargées (en développement)');
