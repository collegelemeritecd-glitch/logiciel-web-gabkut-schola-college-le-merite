// services/budgetAnnuelService.js

const EcritureComptable = require("../models/comptable/EcritureComptable");

const MOIS_LABELS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

async function calculerSoldeTresorerieMois(annee, mois) {
  const dateFrom = new Date(annee, mois - 1, 1, 0, 0, 0, 0);
  const dateTo   = new Date(annee, mois, 0, 23, 59, 59, 999);

  const regexTresorerie = /^5/;

  const stats = await EcritureComptable.aggregate([
    { $match: { dateOperation: { $gte: dateFrom, $lte: dateTo } } },
    { $unwind: "$lignes" },
    { $match: { "lignes.compteNumero": { $regex: regexTresorerie } } },
    {
      $group: {
        _id: "$lignes.sens",
        total: { $sum: "$lignes.montant" },
      },
    },
  ]);

  let totalEncaissements = 0;
  let totalDecaissements = 0;

  stats.forEach((s) => {
    if (s._id === "DEBIT") totalEncaissements = s.total;
    if (s._id === "CREDIT") totalDecaissements = s.total;
  });

  const soldeMois = totalEncaissements - totalDecaissements;

  return { totalEncaissements, totalDecaissements, soldeMois };
}

async function calculerBudgetAnnuel(annee, anneeScolaire) {
  const recapMois = MOIS_LABELS.map((label, index) => ({
    mois: index + 1,
    annee,
    label,
    revenusPrevus: 0,
    revenusReels: 0,
    depensesPrevues: 0,
    depensesReelles: 0,
    epargnePrevue: 0,
    epargneReelle: 0,
  }));

  let tresorerieDisponible = 0;

  for (let mois = 1; mois <= 12; mois++) {
    const { soldeMois } = await calculerSoldeTresorerieMois(annee, mois);
    tresorerieDisponible += soldeMois;
  }

  return {
    annee,
    anneeScolaire,
    recapMois,
    totalRevenusPrevus: 0,
    totalRevenusReels: 0,
    totalDepensesPrevues: 0,
    totalDepensesReelles: 0,
    totalEpargnePrevue: 0,
    totalEpargneReelle: 0,
    resultatAnnuel: 0,
    totalCreancesEleves: 0,
    tresorerieDisponible,
  };
}

module.exports = { calculerBudgetAnnuel };
