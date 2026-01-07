/************************************************************
 📘 PERCEPTEUR DASHBOARD CONTROLLER - CENTRALISÉ
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const Paiement = require('../../models/Paiement');
const Eleve = require('../../models/Eleve');

// ========== DASHBOARD PERCEPTEUR (TOUS LES PAIEMENTS) ==========
exports.getDashboard = async (req, res, next) => {
  try {
    const { anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026' } = req.query;

    console.log('💰 Dashboard Percepteur (CENTRALISÉ):', { anneeScolaire, userId: req.userId });

    // ========== DÉFINIR LES PLAGES DE DATES ==========
    const now = new Date();
    
    // Aujourd'hui
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    // Cette semaine (lundi à dimanche)
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    // Ce mois
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // ========== QUERY DE BASE (PAS DE FILTRE PERCEPTEUR) ==========
    const baseQuery = {
      anneeScolaire,
      statut: 'validé'
    };

    // ========== KPIs ==========
    // Aujourd'hui
    const paiementsToday = await Paiement.find({
      ...baseQuery,
      datePaiement: { $gte: startOfToday, $lt: endOfToday }
    });

    // Cette semaine
    const paiementsWeek = await Paiement.find({
      ...baseQuery,
      datePaiement: { $gte: startOfWeek }
    });

    // Ce mois
    const paiementsMonth = await Paiement.find({
      ...baseQuery,
      datePaiement: { $gte: startOfMonth }
    });

    const kpis = {
      today: {
        total: paiementsToday.reduce((sum, p) => sum + (p.montant || 0), 0),
        count: paiementsToday.length
      },
      week: {
        total: paiementsWeek.reduce((sum, p) => sum + (p.montant || 0), 0),
        count: paiementsWeek.length
      },
      month: {
        total: paiementsMonth.reduce((sum, p) => sum + (p.montant || 0), 0),
        count: paiementsMonth.length
      }
    };

    console.log('💰 KPIs:', `Aujourd'hui ${kpis.today.total} USD, Semaine ${kpis.week.total} USD, Mois ${kpis.month.total} USD`);

    // ========== DERNIERS PAIEMENTS (TOUS) ==========
    const derniersPaiements = await Paiement.find(baseQuery)
      .populate('eleve', 'nom prenom matricule')
      .populate({
        path: 'eleve',
        populate: { path: 'classe', select: 'nom niveau' }
      })
      .sort({ datePaiement: -1 })
      .limit(15);

    console.log('📜', derniersPaiements.length, 'derniers paiements récupérés');

    res.json({
      success: true,
      kpis,
      derniersPaiements
    });

  } catch (error) {
    console.error('❌ Erreur getDashboard:', error);
    next(error);
  }
};
