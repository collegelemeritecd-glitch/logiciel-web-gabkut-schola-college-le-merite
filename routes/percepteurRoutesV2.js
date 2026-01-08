// routes/percepteurRoutesv2.js
const express = require('express');
const router = express.Router();

console.log('✅ percepteurRoutesv2 chargé');

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const percepteurClasseDetailFromEleves = require('../controllers/percepteurClasseDetailFromEleves');
const percepteurClasseDetailExportController = require('../controllers/percepteurClasseDetailExportController');

// Middleware auth global
router.use(authMiddleware);
router.use(requireRole('percepteur', 'admin'));

// Route de test simple
router.get('/ping-v2', (req, res) => {
  console.log('✅ /api/percepteur/ping-v2 atteint');
  res.json({ success: true, source: 'percepteurRoutesv2' });
});

// Détail classe JSON
router.get('/classes/:id/detail', (req, res, next) => {
  console.log('✅ Route détail V2 matche, id =', req.params.id);
  next();
}, percepteurClasseDetailFromEleves.getClasseDetail);

// ➜ Export Excel V2 (chemin aligné avec le front)
router.get('/classes/:id/detail-export-excel-v2', (req, res, next) => {
  console.log('✅ Route Excel V2 matche, id =', req.params.id);
  next();
}, percepteurClasseDetailExportController.exportExcel);

// ➜ Export PDF V2 (optionnel)
router.get('/classes/:id/detail-export-pdf-v2', (req, res, next) => {
  console.log('✅ Route PDF V2 matche, id =', req.params.id);
  next();
}, percepteurClasseDetailExportController.exportPdf);

module.exports = router;
