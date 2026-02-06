// routes/comptable/immobilisations.routes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const requireRole = require('../../middlewares/requireRole');
const controller = require('../../controllers/comptable/immobilisations.controller');

router.use(authMiddleware);
router.use(requireRole('comptable'));

// CRUD immobilisations
router.get('/', controller.listerImmobilisations);
router.get('/:id', controller.getImmobilisation);
router.post('/', controller.creerImmobilisation);
router.put('/:id', controller.mettreAJourImmobilisation);
router.delete('/:id', controller.supprimerImmobilisation);

// Amortissements / plan
router.post('/generer-amortissements', controller.genererAmortissementsPeriode);
router.post('/:id/plan', controller.genererPlan);
router.get('/:id/plan', controller.getPlan);

module.exports = router;
