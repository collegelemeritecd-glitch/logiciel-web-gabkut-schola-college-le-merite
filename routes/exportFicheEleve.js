/************************************************************
 🛣️ ROUTES - EXPORT FICHE ÉLÈVE
 Collège Le Mérite - Gabkut Agency LMK
 routes/exportFicheEleve.js 
*************************************************************/

const express = require('express');
const router = express.Router();
const exportFicheController = require('../controllers/exportFicheEleveController');

// MIDDLEWARES (même pattern que percepteur.js)
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Protection globale : authentification + rôle percepteur
router.use(authMiddleware);
router.use(requireRole('percepteur', 'admin'));

/**
 * @route   GET /api/export-fiche/:id/excel
 * @desc    Export Excel multi-onglets
 * @access  Private (Percepteur)
 */
router.get('/:id/excel', exportFicheController.exportFicheEleveExcel);

/**
 * @route   GET /api/export-fiche/:id/pdf
 * @desc    Export PDF multi-pages
 * @access  Private (Percepteur)
 */
router.get('/:id/pdf', exportFicheController.exportFicheElevePDF);

/**
 * @route   GET /api/export-fiche/download/:filename
 * @desc    Télécharger fichier généré
 * @access  Private (Percepteur)
 */
router.get('/download/:filename', exportFicheController.downloadFichier);

module.exports = router;
