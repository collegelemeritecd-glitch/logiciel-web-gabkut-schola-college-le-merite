/************************************************************
 📘 ROUTES PARENTS - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Middleware pour toutes les routes parents
router.use(authMiddleware);
router.use(requireRole(['parent', 'admin']));

// Dashboard
// router.get('/dashboard', parentsDashboardController.getDashboard);

// Mes enfants
// router.get('/enfants', parentsEnfantsController.getMesEnfants);
// router.get('/enfants/:id', parentsEnfantsController.getEnfantDetail);

// Notes de mes enfants
// router.get('/enfants/:id/notes', parentsNotesController.getNotesEnfant);

// Paiements
// router.get('/paiements', parentsPaiementsController.getMesPaiements);
// router.get('/enfants/:id/frais', parentsFraisController.getFraisEnfant);

// Route temporaire pour tests
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes Parents disponibles (en développement)',
    user: req.user
  });
});

module.exports = router;

console.log('✅ Routes Parents chargées (en développement)');
