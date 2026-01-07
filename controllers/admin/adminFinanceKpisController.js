/************************************************************
 📘 ADMIN FINANCE KPIS CONTROLLER
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');
const Classe = require('../../models/Classe');

exports.getFinanceKpis = async (req, res, next) => {
  try {
    const {
      anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
      mois,
      dateDebut,
      dateFin,
      classeId
    } = req.query;

    console.log('💰 Finance KPIs:', { anneeScolaire, mois, dateDebut, dateFin, classeId });

    // 1) Filtrer les élèves actifs
    const eleveFilter = {
      statut: 'actif',
      anneeScolaire
    };

    if (classeId) {
      eleveFilter.classe = classeId;
    }

    const eleves = await Eleve.find(eleveFilter).populate('classe');

    // 2) Calculer le montant attendu
    let attendu = 0;
    for (const eleve of eleves) {
      if (eleve.classe && eleve.classe.montantFrais) {
        attendu += eleve.classe.montantFrais;
      }
    }

    // 3) Filtrer les paiements validés
    const paiementFilter = {
      statut: 'validé',
      anneeScolaire
    };

    // Filtre par date
    if (dateDebut && dateFin) {
      paiementFilter.datePaiement = {
        $gte: new Date(dateDebut),
        $lte: new Date(dateFin)
      };
    } else if (mois) {
      const year = parseInt(anneeScolaire.split('-')[0], 10);
      const monthInt = parseInt(mois, 10);
      const startDate = new Date(year, monthInt - 1, 1);
      const endDate = new Date(year, monthInt, 0, 23, 59, 59);
      paiementFilter.datePaiement = {
        $gte: startDate,
        $lte: endDate
      };
    }

    if (classeId) {
      const elevesIds = eleves.map(e => e._id);
      paiementFilter.eleve = { $in: elevesIds };
    }

    const paiements = await Paiement.find(paiementFilter);

    // 4) Calculer le total payé
    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);

    // 5) Parents en retard
    let retard = 0;
    for (const eleve of eleves) {
      if (eleve.resteAPayer && eleve.resteAPayer > 0) {
        retard++;
      }
    }

    res.json({
      success: true,
      attendu,
      totalPaye,
      restant: attendu - totalPaye,
      retard,
      filters: { anneeScolaire, mois, dateDebut, dateFin, classeId }
    });

    console.log(`💰 KPIs: Attendu ${attendu}, Payé ${totalPaye}, Retard ${retard}`);
  } catch (error) {
    console.error('❌ Erreur finance KPIs:', error);
    next(error);
  }
};
