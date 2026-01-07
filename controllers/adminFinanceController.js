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

    if (anneeScolaire) {
      filtre.anneeScolaire = anneeScolaire;
    }

    // Mois: tu envoies 1 → Janvier, 2 → Février, etc.
    if (mois) {
      const intMois = parseInt(mois, 10);
      const mapMois = {
        1: 'Janvier',
        2: 'Février',
        3: 'Mars',
        4: 'Avril',
        5: 'Mai',
        6: 'Juin',
        7: 'Juillet',
        8: 'Août',
        9: 'Septembre',
        10: 'Octobre',
        11: 'Novembre',
        12: 'Décembre',
      };
      const mNom = mapMois[intMois];
      if (mNom) {
        filtre.mois = mNom;
      }
    }

    if (classeId) {
      filtre.$or = [
        { classe: classeId },
        { classeRef: classeId },
      ];
    }

    if (dateDebut || dateFin) {
      filtre.datePaiement = {};
      if (dateDebut) {
        filtre.datePaiement.$gte = new Date(dateDebut);
      }
      if (dateFin) {
        const end = new Date(dateFin);
        end.setHours(23, 59, 59, 999);
        filtre.datePaiement.$lte = end;
      }
    }

    filtre.statut = 'valid';

    const paiements = await Paiement.find(filtre)
      .sort({ datePaiement: -1 })
      .limit(20)
      .lean();

    const operations = paiements.map((p) => ({
      id: p._id,
      dateOperation: p.datePaiement || p.createdAt,
      type: p.typePaiement || 'Paiement',
      eleveNom: p.eleveNom || p.eleve?.nom || 'Inconnu',
      classeNom: p.classeNom || p.classe || 'Non définie',
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

    filtre.statut = 'valid';

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

/**
 * GET /admin/finance/evolution-jours
 * Encaissements des 10 derniers jours pour le dashboard admin
 * Query: anneeScolaire?, classeId?
 */
exports.getEvolutionJours = async (req, res) => {
  try {
    const { anneeScolaire, classeId } = req.query;

    const filtre = {};
    const now = new Date();
    const dixJoursAvant = new Date();
    dixJoursAvant.setDate(now.getDate() - 9); // 10 jours incluant aujourd'hui

    filtre.datePaiement = {
      $gte: new Date(dixJoursAvant.setHours(0, 0, 0, 0)),
      $lte: new Date(now.setHours(23, 59, 59, 999)),
    };

    if (anneeScolaire) {
      filtre.anneeScolaire = anneeScolaire;
    }

    if (classeId) {
      filtre.$or = [
        { classe: classeId },
        { classeRef: classeId },
      ];
    }

    filtre.statut = 'valid';

    const data = await Paiement.aggregate([
      { $match: filtre },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$datePaiement' },
          },
          total: { $sum: '$montant' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Map jour -> total
    const map = new Map();
    data.forEach((d) => map.set(d._id, d.total));

    // Générer les 10 derniers jours dans l'ordre
    const labels = [];
    const values = [];

    const cursor = new Date(dixJoursAvant);
    for (let i = 0; i < 10; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;

      labels.push(`${d}/${m}`); // 07/01, 08/01…
      values.push(map.get(key) || 0);

      cursor.setDate(cursor.getDate() + 1);
    }

    return res.json({
      success: true,
      labels,
      values,
    });
  } catch (err) {
    console.error('❌ Erreur getEvolutionJours:', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du calcul de l’évolution journalière.',
      error: err.message,
    });
  }
};
