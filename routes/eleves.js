/************************************************************
 📘 ROUTES ÉLÈVES - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Middleware pour toutes les routes élèves
router.use(authMiddleware);
router.use(requireRole(['student', 'admin']));

// Dashboard
// router.get('/dashboard', elevesDashboardController.getDashboard);

// Mes notes
// router.get('/notes', elevesNotesController.getMesNotes);

// Mes frais scolaires
// router.get('/frais', elevesFraisController.getMesFrais);
// router.get('/paiements', elevesPaiementsController.getMesPaiements);

// Mon emploi du temps
// router.get('/emploi-du-temps', elevesEmploiDuTempsController.getEmploiDuTemps);

// Route temporaire pour tests
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes Élèves disponibles (en développement)',
    user: req.user
  });
});

module.exports = router;

console.log('✅ Routes Élèves chargées (en développement)');
