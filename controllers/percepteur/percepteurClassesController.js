/************************************************************
 📚 PERCEPTEUR CLASSES CONTROLLER - BEAST MODE
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const Classe = require('../../models/Classe');
const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');

// ========== LISTE DES CLASSES ==========
exports.getClasses = async (req, res, next) => {
  try {
    const { anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026' } = req.query;

    console.log('📚 Récupération classes:', anneeScolaire);

    const classes = await Classe.find({ anneeScolaire, isActive: true })
      .sort({ nom: 1 })
      .lean();

    // Enrichir chaque classe avec ses stats
    const classesEnrichies = await Promise.all(
      classes.map(async (classe) => {
        // Compter les élèves
        const effectif = await Eleve.countDocuments({
          classe: classe._id,
          anneeScolaire,
          statut: 'actif'
        });

        // Récupérer tous les élèves avec leurs paiements
        const eleves = await Eleve.find({
          classe: classe._id,
          anneeScolaire,
          statut: 'actif'
        }).lean();

        let montantDuTotal = 0;
        let montantPayeTotal = 0;
        let elevesAJour = 0;
        let elevesRetard = 0;

        for (const eleve of eleves) {
          const fraisDus = classe.montantFrais || 0;
          
          // Calculer le montant payé
          const paiements = await Paiement.find({
            $or: [{ eleve: eleve._id }, { eleveId: eleve._id }],
            anneeScolaire,
            statut: 'validé'
          });

          const montantPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
          const reste = Math.max(0, fraisDus - montantPaye);

          montantDuTotal += fraisDus;
          montantPayeTotal += montantPaye;

          if (reste === 0) {
            elevesAJour++;
          } else {
            elevesRetard++;
          }
        }

        const tauxPaiement = montantDuTotal > 0 
          ? (montantPayeTotal / montantDuTotal) * 100 
          : 0;

        return {
          ...classe,
          stats: {
            effectif,
            elevesAJour,
            elevesRetard,
            montantDuTotal,
            montantPayeTotal,
            soldeDuTotal: montantDuTotal - montantPayeTotal,
            tauxPaiement: parseFloat(tauxPaiement.toFixed(2))
          }
        };
      })
    );

    console.log(`✅ ${classesEnrichies.length} classes récupérées`);

    res.json({
      success: true,
      classes: classesEnrichies
    });

  } catch (error) {
    console.error('❌ Erreur getClasses:', error);
    next(error);
  }
};

// ========== DÉTAIL CLASSE ==========
exports.getClasseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026' } = req.query;

    console.log('📚 Récupération classe:', id);

    const classe = await Classe.findById(id).lean();

    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable'
      });
    }

    // Stats détaillées
    const eleves = await Eleve.find({
      classe: classe._id,
      anneeScolaire,
      statut: 'actif'
    })
      .populate('parent', 'nom email telephone')
      .lean();

    let montantDuTotal = 0;
    let montantPayeTotal = 0;
    let elevesAJour = 0;
    let elevesRetard = 0;

    // Enrichir chaque élève avec ses paiements
    const elevesEnrichis = await Promise.all(
      eleves.map(async (eleve) => {
        const fraisDus = classe.montantFrais || 0;

        const paiements = await Paiement.find({
          $or: [{ eleve: eleve._id }, { eleveId: eleve._id }],
          anneeScolaire,
          statut: 'validé'
        }).sort({ datePaiement: -1 });

        const montantPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
        const reste = Math.max(0, fraisDus - montantPaye);

        montantDuTotal += fraisDus;
        montantPayeTotal += montantPaye;

        if (reste === 0) {
          elevesAJour++;
        } else {
          elevesRetard++;
        }

        return {
          ...eleve,
          montantDu: fraisDus,
          montantPaye,
          soldeDu: reste,
          paiements
        };
      })
    );

    const tauxPaiement = montantDuTotal > 0 
      ? (montantPayeTotal / montantDuTotal) * 100 
      : 0;

    res.json({
      success: true,
      classe: {
        ...classe,
        effectif: eleves.length,
        elevesAJour,
        elevesRetard,
        montantDuTotal,
        montantPayeTotal,
        soldeDuTotal: montantDuTotal - montantPayeTotal,
        tauxPaiement: parseFloat(tauxPaiement.toFixed(2))
      },
      eleves: elevesEnrichis
    });

  } catch (error) {
    console.error('❌ Erreur getClasseById:', error);
    next(error);
  }
};

// ========== ÉLÈVES D'UNE CLASSE ==========
exports.getElevesByClasse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026' } = req.query;

    console.log('👨‍🎓 Récupération élèves classe:', id);

    const classe = await Classe.findById(id).lean();

    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable'
      });
    }

    const eleves = await Eleve.find({
      classe: classe._id,
      anneeScolaire,
      statut: 'actif'
    })
      .populate('parent', 'nom email telephone')
      .sort({ nom: 1, prenom: 1 })
      .lean();

    // Enrichir avec paiements
    const elevesEnrichis = await Promise.all(
      eleves.map(async (eleve) => {
        const fraisDus = classe.montantFrais || 0;

        const paiements = await Paiement.find({
          $or: [{ eleve: eleve._id }, { eleveId: eleve._id }],
          anneeScolaire,
          statut: 'validé'
        });

        const montantPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
        const reste = Math.max(0, fraisDus - montantPaye);

        return {
          ...eleve,
          classe: classe,
          montantDu: fraisDus,
          montantPaye,
          soldeDu: reste,
          nombrePaiements: paiements.length
        };
      })
    );

    console.log(`✅ ${elevesEnrichis.length} élèves récupérés`);

    res.json({
      success: true,
      eleves: elevesEnrichis,
      classe: classe
    });

  } catch (error) {
    console.error('❌ Erreur getElevesByClasse:', error);
    next(error);
  }
};

// ========== STATS CLASSE ==========
exports.getStatsClasse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026' } = req.query;

    console.log('📊 Stats classe:', id);

    const classe = await Classe.findById(id).lean();

    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable'
      });
    }

    // Récupérer tous les élèves
    const eleves = await Eleve.find({
      classe: classe._id,
      anneeScolaire,
      statut: 'actif'
    }).lean();

    // Stats par mois
    const MOIS = [
      'Septembre', 'Octobre', 'Novembre', 'Décembre',
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'
    ];

    const statsParMois = {};
    
    for (const mois of MOIS) {
      const paiementsMois = await Paiement.find({
        classe: classe._id,
        mois,
        anneeScolaire,
        statut: 'validé'
      });

      const montantPaye = paiementsMois.reduce((sum, p) => sum + (p.montant || 0), 0);
      const montantAttendu = eleves.length * (classe.mensualite || 0);

      statsParMois[mois] = {
        montantPaye,
        montantAttendu,
        nombrePaiements: paiementsMois.length,
        tauxRecouvrement: montantAttendu > 0 
          ? (montantPaye / montantAttendu) * 100 
          : 0
      };
    }

    // Stats globales
    let montantDuTotal = 0;
    let montantPayeTotal = 0;
    let elevesAJour = 0;
    let elevesRetard = 0;

    for (const eleve of eleves) {
      const fraisDus = classe.montantFrais || 0;

      const paiements = await Paiement.find({
        $or: [{ eleve: eleve._id }, { eleveId: eleve._id }],
        anneeScolaire,
        statut: 'validé'
      });

      const montantPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
      const reste = Math.max(0, fraisDus - montantPaye);

      montantDuTotal += fraisDus;
      montantPayeTotal += montantPaye;

      if (reste === 0) elevesAJour++;
      else elevesRetard++;
    }

    const tauxPaiement = montantDuTotal > 0 
      ? (montantPayeTotal / montantDuTotal) * 100 
      : 0;

    res.json({
      success: true,
      stats: {
        effectif: eleves.length,
        elevesAJour,
        elevesRetard,
        montantDuTotal,
        montantPayeTotal,
        soldeDuTotal: montantDuTotal - montantPayeTotal,
        tauxPaiement: parseFloat(tauxPaiement.toFixed(2)),
        statsParMois
      }
    });

  } catch (error) {
    console.error('❌ Erreur getStatsClasse:', error);
    next(error);
  }
};

console.log('✅ Percepteur Classes Controller chargé');
