// controllers/percepteurClasseDetailFromEleves.js
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
    const annee =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';

    console.log('📊 GET /classes/%s/detail - Année: %s', classeId, annee);

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

    // 🔁 Copier EXACTEMENT la logique du GET /eleves
    const filter = { anneeScolaire: annee, classe: classeId };

    const eleves = await Eleve.find(filter)
      .populate('classe', 'nom niveau montantFrais')
      .lean();

    console.log('👨‍🎓 %d élèves trouvés (détail) pour %s', eleves.length, classe.nom);

    if (eleves.length === 0) {
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

    const paiements = await Paiement.find({
      $or: [
        { eleveId: { $in: eleveIds } },
        { eleve:   { $in: eleveIds } },
      ],
      anneeScolaire: annee,
      statut: { $in: ['valid', 'validé'] },
    }).lean();

    console.log('💳 %d paiements trouvés (détail)', paiements.length);

    const paiementsParEleve = {};
    paiements.forEach(p => {
      const key = (p.eleveId || p.eleve)?.toString();
      if (!key) return;
      if (!paiementsParEleve[key]) paiementsParEleve[key] = [];
      paiementsParEleve[key].push(p);
    });

    let totalPayeGlobal = 0;
    let totalResteGlobal = 0;

    const elevesFront = eleves.map(e => {
      const key = e._id.toString();
      const paiementsEleve = paiementsParEleve[key] || [];

      const totalPaye = paiementsEleve.reduce(
        (sum, p) => sum + (p.montant || 0),
        0
      );

      const montantDu =
        e.montantDu || (e.classe?.montantFrais || 0);

      const solde = Math.max(0, montantDu - totalPaye);
      totalPayeGlobal += totalPaye;
      totalResteGlobal += solde;

      // Construire paiementsMois comme attendu par classe-detail.js
      const paiementsMois = {};
      MOIS_ANNEE.forEach(m => { paiementsMois[m] = 0; });

      paiementsEleve.forEach(p => {
        const mois = p.mois;
        if (mois && paiementsMois[mois] !== undefined) {
          paiementsMois[mois] += p.montant || 0;
        }
      });

      return {
        id: key,
        code: e.matricule,
        nomComplet: `${e.nom || ''} ${e.postnom || ''} ${e.prenom || ''}`.trim(),
        sexe: e.sexe,
        montantAttendu: montantDu,
        paiementsMois
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
    console.error('Erreur getClasseDetailFromEleves:', err);
    return res.status(500).json({
      success: false,
      message: "Erreur interne lors du chargement du détail de la classe."
    });
  }
};
