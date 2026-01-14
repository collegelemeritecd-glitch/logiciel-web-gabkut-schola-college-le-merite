/************************************************************
 📘 ADMIN FINANCE CONTROLLER - KPIs + Historique + Rapports
 Collège Le Mérite - Gabkut Schola
 Gabkut Agency LMK +243822783500
*************************************************************/

const Paiement = require('../../models/Paiement');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');


// @desc    GET - Vue d'ensemble financière (simple)
// @route   GET /api/admin/finance
// @access  Admin only (GET)
exports.getFinance = async (req, res, next) => {
  try {
    console.log('💰 Admin demande vue finance');

    const anneeScolaire =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';

    // Total paiements validés
    const paiementsValides = await Paiement.aggregate([
      {
        $match: {
          statut: 'validé',
          anneeScolaire,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$montant' },
        },
      },
    ]);

    const totalPercu = paiementsValides[0]?.total || 0;

    // Total attendu (élèves actifs × frais annuels)
    const elevesActifsDocs = await Eleve.find({
      statut: 'actif',
      anneeScolaire,
    }).populate('classe');

    const totalAttendu = elevesActifsDocs.reduce((sum, eleve) => {
      return sum + (eleve.classe?.montantFrais || 0);
    }, 0);

    const totalRestant = totalAttendu - totalPercu;
    const tauxRecouvrement =
      totalAttendu > 0
        ? ((totalPercu / totalAttendu) * 100).toFixed(2)
        : 0;

    res.json({
      success: true,
      finance: {
        totalAttendu,
        totalPercu,
        totalRestant,
        tauxRecouvrement: parseFloat(tauxRecouvrement),
        anneeScolaire,
        nbElevesActifs: elevesActifsDocs.length,
      },
    });

    console.log('✅ Finance envoyée');
  } catch (error) {
    console.error('❌ Erreur finance:', error);
    next(error);
  }
};


// @desc    GET - KPIs financiers détaillés (aligné sur élèves/classes)
// @route   GET /api/admin/finance/kpis
// @access  Admin only (GET)
exports.getFinanceKPIs = async (req, res, next) => {
  try {
    console.log('📊 Admin demande KPIs financiers (v2 alignée)');

    const anneeScolaire =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';

    // 1) Élèves actifs de l'année
    const eleves = await Eleve.find({
      statut: 'actif',
      anneeScolaire,
    }).populate('classe');

    const elevesActifs = eleves.length;

    // 2) Total attendu / payé / restant
    let totalAttendu = 0;
    let totalPaye = 0;
    let totalRestant = 0;

    for (const e of eleves) {
      // Montant attendu = classe.montantFrais si dispo, sinon Eleve.montantDu
      const attendu =
        (e.classe && typeof e.classe.montantFrais === 'number'
          ? e.classe.montantFrais
          : e.montantDu || 0);

      totalAttendu += attendu;

      // Montant payé / restant maintenus par les middlewares Paiement
      const paye = e.totalPaye || e.montantPaye || 0;
      const reste =
        e.resteAPayer != null ? e.resteAPayer : Math.max(0, attendu - paye);

      totalPaye += paye;
      totalRestant += reste;
    }

    // 3) Agrégations paiements par type / mode / mois
    const [paiementsParType, paiementsParMode, paiementsParMois] =
      await Promise.all([
        Paiement.aggregate([
          { $match: { anneeScolaire, statut: 'validé' } },
          {
            $group: {
              _id: '$typePaiement',
              total: { $sum: '$montant' },
              count: { $sum: 1 },
            },
          },
        ]),
        Paiement.aggregate([
          { $match: { anneeScolaire, statut: 'validé' } },
          {
            $group: {
              _id: '$modePaiement',
              total: { $sum: '$montant' },
              count: { $sum: 1 },
            },
          },
        ]),
        Paiement.aggregate([
          { $match: { anneeScolaire, statut: 'validé' } },
          {
            $group: {
              _id: '$mois',
              total: { $sum: '$montant' },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

    // 4) Classes “rentables” via revenusReels / effectif
    const classes = await Classe.find({ isActive: true });

    const classesRentables = classes
      .map((c) => ({
        _id: c._id,
        nom: c.nom,
        niveau: c.niveau,
        total: c.revenusReels || 0,
        count: c.effectif || 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // 5) Taux de recouvrement
    const tauxRecouvrement =
      totalAttendu > 0
        ? parseFloat(((totalPaye / totalAttendu) * 100).toFixed(2))
        : 0;

    res.json({
      success: true,
      anneeScolaire,
      kpis: {
        // Vue d'ensemble
        elevesActifs,
        totalClasses: classes.length,
        anneeScolaire,

        // Financier (aligné sur ce que voient élèves/classes)
        recettesTotales: totalPaye,
        totalAttendu,
        totalRestant,
        tauxRecouvrement,

        // Détails pour les listes
        paiementsParType,
        paiementsParMode,
        paiementsParMois,
        classesRentables,
      },
    });

    console.log('✅ KPIs financiers envoyés (v2)');
  } catch (error) {
    console.error('❌ Erreur KPIs (v2):', error);
    next(error);
  }
};


// @desc    GET - Historique des paiements avec filtres
// @route   GET /api/admin/finance/historique
// @access  Admin only (GET)
exports.getFinanceHistorique = async (req, res, next) => {
  try {
    console.log('📜 Admin demande historique paiements');

    const {
      anneeScolaire,
      classe,
      mois,
      typePaiement,
      modePaiement,
      dateDebut,
      dateFin,
      limit = 100,
      page = 1,
    } = req.query;

    const filter = { statut: 'validé' };

    if (anneeScolaire) filter.anneeScolaire = anneeScolaire;
    if (classe) filter.classe = classe;
    if (mois) filter.mois = mois;
    if (typePaiement) filter.typePaiement = typePaiement;
    if (modePaiement) filter.modePaiement = modePaiement;

    if (dateDebut || dateFin) {
      filter.datePaiement = {};
      if (dateDebut) filter.datePaiement.$gte = new Date(dateDebut);
      if (dateFin) filter.datePaiement.$lte = new Date(dateFin);
    }

    console.log('🔍 Filtre historique:', filter);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [paiements, total] = await Promise.all([
      Paiement.find(filter)
        .populate('eleve', 'nom prenom matricule')
        .populate('classe', 'nom niveau')
        .populate('percepteur', 'fullName')
        .sort({ datePaiement: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Paiement.countDocuments(filter),
    ]);

    const totauxAgg = await Paiement.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalMontant: { $sum: '$montant' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      success: true,
      paiements,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
      totaux: {
        montant: totauxAgg[0]?.totalMontant || 0,
        count: totauxAgg[0]?.count || 0,
      },
    });

    console.log(`✅ ${paiements.length} paiements envoyés (${total} total)`);
  } catch (error) {
    console.error('❌ Erreur historique:', error);
    next(error);
  }
};


// @desc    GET - Rapport financier par classe
// @route   GET /api/admin/finance/rapport-classes
// @access  Admin only (GET)
exports.getFinanceRapportClasses = async (req, res, next) => {
  try {
    console.log('📋 Admin demande rapport par classe');

    const anneeScolaire =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';

    const classes = await Classe.find({ isActive: true }).sort({
      niveau: 1,
      nom: 1,
    });

    const rapportClasses = await Promise.all(
      classes.map(async (classe) => {
        const effectif = await Eleve.countDocuments({
          classe: classe._id,
          statut: 'actif',
          anneeScolaire,
        });

        const totalAttendu = effectif * (classe.montantFrais || 0);

        const paiements = await Paiement.aggregate([
          {
            $match: {
              classe: classe._id,
              statut: 'validé',
              anneeScolaire,
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$montant' },
            },
          },
        ]);

        const totalPaye = paiements[0]?.total || 0;
        const totalRestant = totalAttendu - totalPaye;
        const tauxRecouvrement =
          totalAttendu > 0
            ? ((totalPaye / totalAttendu) * 100).toFixed(2)
            : 0;

        return {
          classe: {
            _id: classe._id,
            nom: classe.nom,
            niveau: classe.niveau,
            montantFrais: classe.montantFrais,
            mensualite: classe.mensualite,
          },
          effectif,
          totalAttendu,
          totalPaye,
          totalRestant,
          tauxRecouvrement: parseFloat(tauxRecouvrement),
        };
      })
    );

    const totauxGlobaux = rapportClasses.reduce(
      (acc, r) => ({
        effectifTotal: acc.effectifTotal + r.effectif,
        attenduTotal: acc.attenduTotal + r.totalAttendu,
        payeTotal: acc.payeTotal + r.totalPaye,
        restantTotal: acc.restantTotal + r.totalRestant,
      }),
      { effectifTotal: 0, attenduTotal: 0, payeTotal: 0, restantTotal: 0 }
    );

    totauxGlobaux.tauxRecouvrementGlobal =
      totauxGlobaux.attenduTotal > 0
        ? (
            (totauxGlobaux.payeTotal / totauxGlobaux.attenduTotal) *
            100
          ).toFixed(2)
        : 0;

    res.json({
      success: true,
      anneeScolaire,
      classes: rapportClasses,
      totaux: totauxGlobaux,
    });

    console.log('✅ Rapport classes envoyé');
  } catch (error) {
    console.error('❌ Erreur rapport classes:', error);
    next(error);
  }
};


// @desc    GET - Statistiques mensuelles
// @route   GET /api/admin/finance/stats-mensuelles
// @access  Admin only (GET)
exports.getStatsMensuelles = async (req, res, next) => {
  try {
    console.log('📈 Admin demande stats mensuelles');

    const anneeScolaire =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';

    const statsMois = await Paiement.aggregate([
      {
        $match: {
          anneeScolaire,
          statut: 'validé',
        },
      },
      {
        $group: {
          _id: {
            mois: '$mois',
            typePaiement: '$typePaiement',
          },
          montant: { $sum: '$montant' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.mois': 1 },
      },
    ]);

    const moisOrdre = [
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

    const statsParMois = moisOrdre.map((mois) => {
      const paiementsMois = statsMois.filter((s) => s._id.mois === mois);
      const totalMois = paiementsMois.reduce(
        (sum, p) => sum + p.montant,
        0
      );
      const countMois = paiementsMois.reduce(
        (sum, p) => sum + p.count,
        0
      );

      return {
        mois,
        total: totalMois,
        count: countMois,
        parType: paiementsMois.map((p) => ({
          type: p._id.typePaiement,
          montant: p.montant,
          count: p.count,
        })),
      };
    });

    res.json({
      success: true,
      anneeScolaire,
      stats: statsParMois,
    });

    console.log('✅ Stats mensuelles envoyées');
  } catch (error) {
    console.error('❌ Erreur stats mensuelles:', error);
    next(error);
  }
};
