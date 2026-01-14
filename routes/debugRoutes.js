// backend/routes/debugRoutes.js
const express = require('express');
const router = express.Router();
const PaiementIntention = require('../models/PaiementIntention');

router.get('/intention-derniere', async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Paramètre "reference" manquant',
      });
    }

    const intention = await PaiementIntention.findOne({
      reference: String(reference).trim(),
      status: 'pending',
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!intention) {
      return res.status(404).json({
        success: false,
        message: `Aucune intention pending trouvée pour ${reference}`,
      });
    }

    return res.json({ success: true, intention });
  } catch (err) {
    console.error('❌ Erreur /api/debug/intention-derniere:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur debug intention',
    });
  }
});

module.exports = router;
