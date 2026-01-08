// controllers/percepteurClasseDetailProxy.js
/************************************************************
 👨‍🎓 PERCEPTEUR - DÉTAIL CLASSE (PROXY ELEVE)
 Gabkut Agency LMK - Collège Le Mérite 2026
 Utilise la même logique que /api/percepteur/eleves
 pour construire le détail d'une classe.
*************************************************************/

const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const Paiement = require('../models/Paiement');

const MOIS_ANNEE = [
  'Septembre', 'Octobre', 'Novembre', 'Decembre',
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin'
];

// GET /api/percepteur/classes/:id/detail?anneeScolaire=2025-2026
exports.getClasseDetail = async (req, res) => {
  try {
    const classeId = req.params.id;
    const anneeScolaire =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';

    console.log(
      '📊 GET /classes/%s/detail - Année: %s',
      classeId,
      anneeScolaire
    );

    if (!classeId) {
      return res.status(400).json({
        success: false,
        message: 'Classe manquante.'
      });
    }

    const classe = await Classe.findById(classeId).lean();
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable.'
      });
    }

    // 🔁 Même filtre que /percepteur/eleves
    const filter = {
      anneeScolaire: anneeScolaire,
      classe: classeId
    };

    console.log('🧩 Filtre Eleves Détail Classe =', filter);

    const eleves = await Eleve.find(filter)
      .populate('classe', 'nom niveau montantFrais')
      .lean();

    console.log(
      '👨‍🎓 %d élèves trouvés pour la classe %s',
      eleves.length,
      classe.nom
    );

    if (!eleves.length) {
      return res.json({
        success: true,
        classe: {
          _id: classe._id,
          nom: classe.nom,
          niveau: classe.niveau,
          montantFrais: classe.montantFrais || null,
          effectif: 0
        },
        eleves: []
      });
    }

    const eleveIds = eleves.map(e => e._id);

    // 🔁 Même logique paiements que /percepteur/eleves
    const paiements = await Paiement.find({
      $or: [
        { eleveId: { $in: eleveIds } },
        { eleve: { $in: eleveIds } },
      ],
      anneeScolaire,
      statut: { $in: ['valid', 'validé'] },
    }).lean();

    console.log('💳 %d paiements trouvés', paiements.length);

    const paiementsParEleve = {};
    paiements.forEach(p => {
      const key = (p.eleveId || p.eleve)?.toString();
      if (!key) return;
      if (!paiementsParEleve[key]) paiementsParEleve[key] = {};
      const mois = p.mois || 'Autre';
      if (!paiementsParEleve[key][mois]) paiementsParEleve[key][mois] = 0;
      paiementsParEleve[key][mois] += p.montant || 0;
    });

    let totalPayeGlobal = 0;
    let totalResteGlobal = 0;

    const elevesFront = eleves.map(e => {
      const key = e._id.toString();
      const paiementsMois = paiementsParEleve[key] || {};

      // Aligné avec eleves.js : fraisTotal = montantDu || montantFrais
      const montantDu =
        e.montantDu ||
        (e.classe?.montantFrais || 0);

      const totalPaye = Object.values(paiementsMois).reduce(
        (sum, m) => sum + (m || 0),
        0
      );

      const solde = Math.max(0, montantDu - totalPaye);

      totalPayeGlobal += totalPaye;
      totalResteGlobal += solde;

      const paiementsMoisComplets = {};
      MOIS_ANNEE.forEach(m => {
        paiementsMoisComplets[m] = paiementsMois[m] || 0;
      });

      return {
        id: key,
        code: e.matricule,
        nomComplet: `${e.nom || ''} ${e.postnom || ''} ${e.prenom || ''}`.trim(),
        sexe: e.sexe,
        montantAttendu: montantDu,
        paiementsMois: paiementsMoisComplets
      };
    });

    console.log(
      '💰 Stats Détail Classe - Total payé: %d, Total reste: %d',
      totalPayeGlobal,
      totalResteGlobal
    );

    return res.json({
      success: true,
      classe: {
        _id: classe._id,
        nom: classe.nom,
        niveau: classe.niveau,
        montantFrais: classe.montantFrais || null,
        effectif: elevesFront.length
      },
      eleves: elevesFront
    });
  } catch (err) {
    console.error('Erreur getClasseDetail (proxy):', err);
    return res.status(500).json({
      success: false,
      message: "Erreur interne lors du chargement du détail de la classe."
    });
  }
};
