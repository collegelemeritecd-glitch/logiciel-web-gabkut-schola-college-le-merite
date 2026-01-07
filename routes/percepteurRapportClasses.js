/************************************************************
 📊 ROUTES - RAPPORT CLASSES PERCEPTEUR
 Collège Le Mérite - Express Routes
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ⚠️ Adapter les chemins selon ta structure
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const rapportClassesController = require('../controllers/percepteur/percepteurRapportClassesController');

/**
 * 🔐 Toutes les routes sont protégées
 * Seuls les percepteurs et admins peuvent y accéder
 */
router.use(authMiddleware);
router.use(requireRole('percepteur', 'admin'));

// ============================================================
// 📊 GET - RAPPORT CLASSES (JSON pour le frontend)
// ============================================================

/**
 * GET /api/percepteur/rapport-classes
 */
router.get('/', rapportClassesController.getRapportClasses);

// ============================================================
// 📤 EXPORTS - EXCEL / PDF / WORD
// ============================================================

/**
 * GET /api/percepteur/rapport-classes/export-excel
 * → Fichier XLSX classique
 */
router.get('/export-excel', rapportClassesController.exportExcel);

/**
 * GET /api/percepteur/rapport-classes/export-excel-premium-v3
 * → Fichier XLSX PREMIUM (multi-onglets)
 */
router.get('/export-excel-premium-v3', rapportClassesController.exportExcelPremiumV3);

/**
 * GET /api/percepteur/rapport-classes/export-pdf
 * → Fichier PDF
 */
router.get('/export-pdf', rapportClassesController.exportPDF);

/**
 * GET /api/percepteur/rapport-classes/export-word
 * → Fichier DOCX (si tu as exportWord dans le controller)
 */
// router.get('/export-word', rapportClassesController.exportWord);

// ============================================================
// 📥 DOWNLOAD FICHIER TEMPORAIRE
// ============================================================

router.get('/download/:fileName', (req, res) => {
  try {
    const tempDir = path.join(__dirname, '../..', 'temp');
    const filePath = path.join(tempDir, req.params.fileName);

    if (!filePath.startsWith(tempDir)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.download(filePath, (err) => {
      if (err) {
        console.error('Download error:', err);
      }
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    console.error('Erreur téléchargement:', err);
    res.status(500).json({ error: 'Erreur téléchargement' });
  }
});

module.exports = router;
