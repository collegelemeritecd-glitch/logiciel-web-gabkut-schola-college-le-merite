// routes/percepteurRapportClasses.js

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const rapportClassesController = require('../controllers/percepteur/percepteurRapportClassesController');

router.use(authMiddleware);
router.use(requireRole('percepteur', 'admin'));

router.get('/', rapportClassesController.getRapportClasses);
router.get('/export-excel', rapportClassesController.exportExcel);
router.get('/export-pdf', rapportClassesController.exportPDF);
router.get('/download/:fileName', (req, res) => { // oui la route est là mais elle nourrit une autre page.
  const path = require('path');
  const fs = require('fs');

  try {
    const tempDir = path.join(__dirname, '../..', 'temp');
    const filePath = path.join(tempDir, req.params.fileName);

    if (!filePath.startsWith(tempDir)) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.download(filePath, (err) => {
      if (err) console.error('Download error:', err);
      fs.unlink(filePath, () => {});
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur téléchargement' });
  }
});

module.exports = router;
