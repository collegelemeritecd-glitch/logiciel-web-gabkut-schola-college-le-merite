/************************************************************
 📘 GABKUT SCHOLA - ADMIN FINANCE CONTROLLER
 Lecture seule des données Percepteur/Comptable pour l’admin
*************************************************************/

const Paiement = require('../models/Paiement');

/**
 * GET /admin/finance/last-operations
 * Derniers paiements (toutes sources) pour le dashboard admin
 * Query: anneeScolaire?, mois?, classeId?, dateDebut?, dateFin?
 */
exports.getLastOperations = async (req, res) => {
  try {
    const {
      anneeScolaire,
      mois,
      classeId,
      dateDebut,
      dateFin,
    } = req.query;

    const filtre = {};

    // Année scolaire
    if (anneeScolaire) {
      filtre.anneeScolaire = anneeScolaire;
    }

    // Mois (string dans le modèle: Septembre, Octobre, ...)
    if (mois) {
      // tu peux mapper 1→Septembre, 2→Octobre, etc. si besoin
      // ici on suppose que le frontend envoie déjà le texte correct,
      // sinon adapte avec un mapping.
      filtre.mois = mois;
    }

    // Classe
    if (classeId) {
      // dans ton modèle tu as classe (ObjectId) + classeRef + classeNom
      filtre.$or = [
        { classe: classeId },
        { classeRef: classeId },
      ];
    }

    // Période de dates
    if (dateDebut || dateFin) {
      filtre.datePaiement = {};
      if (dateDebut) {
        filtre.datePaiement.$gte = new Date(dateDebut);
      }
      if (dateFin) {
        // fin de journée
        const end = new Date(dateFin);
        end.setHours(23, 59, 59, 999);
        filtre.datePaiement.$lte = end;
      }
    }

    // On prend uniquement les paiements valides
    filtre.statut = 'valid';

    const paiements = await Paiement.find(filtre)
      .sort({ datePaiement: -1 })       // plus récents d’abord
      .limit(20)                        // 20 dernières opérations
      .lean();

    const operations = paiements.map((p) => ({
      id: p._id,
      dateOperation: p.datePaiement || p.createdAt,
      type: p.typePaiement || 'Paiement',
      eleveNom: p.eleveNom || 'Inconnu',
      classeNom: p.classeNom || (p.classe && p.classe.nom) || 'Non définie',
      montant: p.montant || p.montantPaye || 0,
      auteur: p.percepteurNom || 'Percepteur',
      moyenPaiement: p.moyenPaiement || p.modePaiement || 'Cash',
      reference: p.reference,
      statut: p.statut,
    }));

    return res.json({ success: true, operations });
  } catch (err) {
    console.error('❌ Erreur getLastOperations:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des dernières opérations.',
      error: err.message,
    });
  }
};

/**
 * GET /admin/finance/mensuel
 * Agrégat des encaissements par mois pour Chart.js
 * Query: anneeScolaire?, classeId?
 */
exports.getFinanceMensuelle = async (req, res) => {
  try {
    const { anneeScolaire, classeId } = req.query;

    const filtre = {};

    if (anneeScolaire) {
      filtre.anneeScolaire = anneeScolaire;
    }

    if (classeId) {
      filtre.$or = [
        { classe: classeId },
        { classeRef: classeId },
      ];
    }

    // uniquement paiements valides
    filtre.statut = 'valid';

    // Agrégation par mois (champ string "Septembre", etc.)
    const data = await Paiement.aggregate([
      { $match: filtre },
      {
        $group: {
          _id: '$mois',
          total: { $sum: '$montant' },
        },
      },
    ]);

    const ordreMois = [
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
    ];

    // Map pour retrouver les totaux
    const map = new Map();
    data.forEach((d) => map.set(d._id, d.total));

    const labels = ordreMois;
    const values = ordreMois.map((m) => map.get(m) || 0);

    return res.json({
      success: true,
      labels,
      values,
    });
  } catch (err) {
    console.error('❌ Erreur getFinanceMensuelle:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul des encaissements mensuels.',
      error: err.message,
    });
  }
};
