/************************************************************
 📘 ROUTES ENSEIGNANTS - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Middleware pour toutes les routes enseignants
router.use(authMiddleware);
router.use(requireRole(['teacher', 'admin']));

// Dashboard
// router.get('/dashboard', enseignantsDashboardController.getDashboard);

// Mes classes
// router.get('/classes', enseignantsClassesController.getMesClasses);
// router.get('/classes/:id', enseignantsClassesController.getClasseDetail);

// Notes
// router.get('/classes/:id/notes', enseignantsNotesController.getNotes);
// router.post('/classes/:id/notes', enseignantsNotesController.ajouterNote);
// router.put('/notes/:id', enseignantsNotesController.modifierNote);

// Présence élèves
// router.post('/classes/:id/presence', enseignantsPresenceController.marquerPresence);
// router.get('/classes/:id/presence', enseignantsPresenceController.getPresence);

// Route temporaire pour tests
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes Enseignants disponibles (en développement)',
    user: req.user
  });
});

module.exports = router;

console.log('✅ Routes Enseignants chargées (en développement)');
