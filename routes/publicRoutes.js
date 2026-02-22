// routes/publicRoutes.js
const express = require('express');
const router = express.Router();

const publicVerificationController = require('../controllers/publicVerificationController');
const publicNoticesController = require('../controllers/publicNoticesController');
const Classe = require('../models/Classe');
const Eleve = require('../models/Eleve'); // 🔹 on importe le modèle Eleve
const publicTeachersController = require('../controllers/public/publicTeachersController');

/**
 * 📌 VÉRIFICATION PUBLIQUE D’UN DOCUMENT
 * GET /api/public/verif/:code
 */
router.get(
  '/verif/:code',
  publicVerificationController.verifierDocument
);

/**
 * 📌 EXPORT DU RAPPORT PDF (PUBLIC)
 * GET /api/public/verif/:code/export
 */
router.get(
  '/verif/:code/export',
  publicVerificationController.exporterRapport
);

// 📘 Liste publique des classes actives (sans auth)
router.get('/classes-actives', async (req, res) => {
  try {
    const classes = await Classe.find({ isActive: true })
      .select('nom niveau montantFrais effectif')
      .sort({ nom: 1 })
      .lean();

    return res.json({
      success: true,
      classes: classes.map((c) => ({
        id: c._id,
        nom: c.nom,
        niveau: c.niveau,
        montantFrais: c.montantFrais,
        effectif: c.effectif || 0,
      })),
    });
  } catch (err) {
    console.error('Erreur /api/public/classes-actives:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du chargement des classes',
    });
  }
});

/**
 * 📌 RECHERCHE PUBLIQUE D'ÉLÈVE (pour retrouver le matricule)
 * GET /api/public/eleves/recherche?q=...
 */
router.get('/eleves/recherche', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ success: true, eleves: [] });
    }

    const regex = new RegExp(q, 'i');

    const eleves = await Eleve.find({
      $or: [
        { nom: regex },
        { prenom: regex },
        { matricule: regex },
        { telephoneParent: regex },
      ],
    })
      .select('nom prenom matricule classe')
      .populate('classe', 'nom')
      .limit(20)
      .lean();

    return res.json({ success: true, eleves });
  } catch (err) {
    console.error('Erreur /api/public/eleves/recherche:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la recherche des élèves',
    });
  }
});

/**
 * 📌 ENVOI DU RAPPORT PAR EMAIL (PUBLIC)
 * POST /api/public/verif/:code/email
 * body: { email }
 */
router.post(
  '/verif/:code/email',
  publicVerificationController.envoyerRapportParEmail
);

// Communiqués publics (lecture seule)
router.get('/notices', publicNoticesController.getNotices);
router.get('/notices/:id', publicNoticesController.getNoticeById);
router.get('/teachers', publicTeachersController.getTeachers);
// liste
router.get('/teachers', publicTeachersController.getTeachers);
// profil
router.get('/teachers/:id', publicTeachersController.getTeacherById);

module.exports = router;
