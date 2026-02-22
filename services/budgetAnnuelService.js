// services/budgetAnnuelService.js

const DepenseBudget = require("../models/DepenseBudget");
const { injecterReelDepuisComptesPrefixes } = require("./budgetUtils");
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
    depensesFixes: 0,
    depensesVariables: 0,
    depensesCredits: 0,
  }));

  let tresorerieDisponible = 0;

  // 1) Boucle sur les 12 mois
  for (let mois = 1; mois <= 12; mois++) {
    const m = recapMois[mois - 1];

    // 1a) Paramètres budget pour ce mois (tous types)
    const lignesBudget = await DepenseBudget.find({
      annee,
      anneeScolaire,
      mois,
    }).lean();

    // 1b) Injecter le réel par comptesPrefixes
    const lignesAvecReel = await injecterReelDepuisComptesPrefixes(
      annee,
      mois,
      lignesBudget
    );

    // 1c) Alimenter les agrégats du mois, par type
    lignesAvecReel.forEach((l) => {
      const type = l.type;
      const prevu = Number(
        l.prevu ??
        l.montantPrevu ??
        0
      );
      const reel = Number(
        l.reel ??
        l.montantReel ??
        0
      );

      if (type === "fixe") {
        m.depensesFixes += prevu;
        m.depensesPrevues += prevu;
        m.depensesReelles += reel;
      } else if (type === "variable") {
        m.depensesVariables += prevu;
        m.depensesPrevues += prevu;
        m.depensesReelles += reel;
      } else if (type === "credit") {
        m.depensesCredits += prevu;
        m.depensesPrevues += prevu;
        m.depensesReelles += reel;
      } else if (type === "epargne") {
        m.epargnePrevue += prevu;
        m.epargneReelle += reel;
      }
    });

    // 1d) Trésorerie pour ce mois
    const { soldeMois } = await calculerSoldeTresorerieMois(annee, mois);
    tresorerieDisponible += soldeMois;
  }

  // 2) Totaux annuels à partir de recapMois
  let totalDepensesPrevues = 0;
  let totalDepensesReelles = 0;
  let totalEpargnePrevue = 0;
  let totalEpargneReelle = 0;

  recapMois.forEach((m) => {
    totalDepensesPrevues += m.depensesPrevues || 0;
    totalDepensesReelles += m.depensesReelles || 0;
    totalEpargnePrevue += m.epargnePrevue || 0;
    totalEpargneReelle += m.epargneReelle || 0;
  });

  const resultatAnnuel = 0 - totalDepensesReelles; // si tu ajoutes plus tard les revenus, tu corriges ici
  const totalCreancesEleves = 0; // idem, à compléter quand tu brancheras les revenus

  return {
    annee,
    anneeScolaire,
    recapMois,
    totalRevenusPrevus: 0,
    totalRevenusReels: 0,
    totalDepensesPrevues,
    totalDepensesReelles,
    totalEpargnePrevue,
    totalEpargneReelle,
    resultatAnnuel,
    totalCreancesEleves,
    tresorerieDisponible,
  };
}

module.exports = { calculerBudgetAnnuel };
