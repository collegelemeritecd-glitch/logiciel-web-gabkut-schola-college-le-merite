// controllers/admin/adminFinanceHistoriqueController.js
const Paiement = require('../../models/Paiement');

exports.getHistoriquePaiements = async (req, res, next) => {
  try {
    const { anneeScolaire, classeId, statut } = req.query;

    const filter = {};

    if (anneeScolaire) {
      filter.anneeScolaire = anneeScolaire;
    }

    // si tu veux filtrer sur une classe précise
    if (classeId) {
      filter.classe = classeId;
    }

    // par défaut on peut renvoyer seulement les paiements validés
    if (statut) {
      filter.statut = statut;
    } else {
      filter.statut = 'validé';
    }

    const paiements = await Paiement.find(filter)
      .sort({ datePaiement: -1 })
      .lean();

    res.json({ paiements });
  } catch (err) {
    console.error('Erreur getHistoriquePaiements:', err);
    next(err);
  }
};
