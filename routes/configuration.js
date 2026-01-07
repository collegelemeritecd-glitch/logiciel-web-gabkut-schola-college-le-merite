/************************************************************
 📘 ROUTES CONFIGURATION - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

// ============================================================
// 📅 GET ANNÉE SCOLAIRE ACTIVE
// ============================================================
router.get('/annee-active', (req, res) => {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    // Si mois >= août (8), on démarre nouvelle année scolaire
    const anneeScolaire = month >= 8 
      ? `${year}-${year + 1}` 
      : `${year - 1}-${year}`;
    
    const dateDebut = month >= 8 
      ? `${year}-09-01` 
      : `${year - 1}-09-01`;
    
    const dateFin = month >= 8 
      ? `${year + 1}-06-30` 
      : `${year}-06-30`;

    res.json({ 
      success: true,
      anneeScolaire,
      moisActuel: now.toLocaleString('fr-FR', { month: 'long' }),
      dateDebut,
      dateFin,
      moisScolaires: [
        'Septembre', 'Octobre', 'Novembre', 'Décembre',
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'
      ]
    });

  } catch (error) {
    console.error('❌ Erreur année active:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ============================================================
// 💰 GET MOYENS DE PAIEMENT
// ============================================================
router.get('/moyens-paiement', (req, res) => {
  res.json({
    success: true,
    moyens: [
      { id: 'cash', label: 'Cash', icon: '💵' },
      { id: 'mobile', label: 'Mobile Money', icon: '📱' },
      { id: 'banque', label: 'Banque', icon: '🏦' },
      { id: 'cheque', label: 'Chèque', icon: '📝' }
    ]
  });
});

// ============================================================
// 🎯 GET OBJECTIF MENSUEL
// ============================================================
router.get('/objectif-mensuel', (req, res) => {
  res.json({
    success: true,
    objectif: 1500000,
    devise: 'USD'
  });
});

// ============================================================
// 🧪 TEST
// ============================================================
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '✅ Routes Configuration actives',
    routes: [
      'GET /annee-active',
      'GET /moyens-paiement',
      'GET /objectif-mensuel'
    ]
  });
});

module.exports = router;

console.log('✅ Routes Configuration chargées');
