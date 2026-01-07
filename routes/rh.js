/************************************************************
 📘 ROUTES RH - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Controllers (à créer selon tes besoins)
// const rhDashboardController = require('../controllers/rh/rhDashboardController');
// const rhEnseignantsController = require('../controllers/rh/rhEnseignantsController');

// Middleware pour toutes les routes RH
router.use(authMiddleware);
router.use(requireRole(['rh', 'admin']));

// Dashboard
// router.get('/dashboard', rhDashboardController.getDashboard);

// Enseignants
// router.get('/enseignants', rhEnseignantsController.getEnseignants);
// router.post('/enseignants', rhEnseignantsController.createEnseignant);
// router.put('/enseignants/:id', rhEnseignantsController.updateEnseignant);
// router.delete('/enseignants/:id', rhEnseignantsController.deleteEnseignant);

// Présence
// router.get('/presence', rhPresenceController.getPresence);
// router.post('/presence', rhPresenceController.marquerPresence);

// Congés
// router.get('/conges', rhCongesController.getConges);
// router.post('/conges', rhCongesController.demanderConge);
// router.put('/conges/:id', rhCongesController.traiterConge);

// Paie
// router.get('/paie', rhPaieController.getPaie);
// router.post('/paie', rhPaieController.genererPaie);

// Route temporaire pour tests
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes RH disponibles (en développement)',
    user: req.user
  });
});

module.exports = router;

console.log('✅ Routes RH chargées (en développement)');
