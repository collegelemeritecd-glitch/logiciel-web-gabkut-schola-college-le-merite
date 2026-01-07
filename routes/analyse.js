// routes/analyse.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const classeDetailController = require('../controllers/percepteur/percepteurClasseDetailController');

const path = require('path');
const fs = require('fs');

// Middlewares d'auth
router.use(authMiddleware);
router.use(requireRole('percepteur', 'admin'));

// Détail classe pour l'écran d'analyse
router.get('/classes/:id/detail', classeDetailController.getClasseDetail);

// Exports avancés
router.get('/classes/:id/detail-export-excel', classeDetailController.exportClasseExcel);
router.get('/classes/:id/detail-export-pdf', classeDetailController.exportClassePDF);

// ✅ ROUTE DE TÉLÉCHARGEMENT DES FICHIERS ANALYSE CLASSE
router.get('/classes/download/:fileName', (req, res) => {
  try {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, '..', 'temp', fileName);

    console.log('📄 DOWNLOAD analyse classe:', {
      fileName,
      filePath,
      existe: fs.existsSync(filePath)
    });

    if (!fs.existsSync(filePath)) {
      console.error('❌ Fichier introuvable:', filePath);
      return res.status(404).json({
        success: false,
        message: 'Fichier introuvable sur le site',
        path: filePath
      });
    }

    console.log('✅ Téléchargement fichier:', fileName);
    
    return res.download(filePath, fileName, err => {
      if (err) {
        console.error('❌ Erreur download fichier analyse:', err);
        if (!res.headersSent) {
          res.status(500).send('Erreur lors du téléchargement');
        }
      } else {
        // Nettoyage après téléchargement
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) console.error('❌ Erreur suppression fichier temp:', unlinkErr);
          else console.log('🗑️ Fichier temp supprimé:', fileName);
        });
      }
    });
  } catch (err) {
    console.error('❌ Erreur route /api/percepteur/classes/download:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: err.message
    });
  }
});

module.exports = router;
