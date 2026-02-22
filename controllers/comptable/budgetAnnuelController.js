// controllers/comptable/budgetAnnuelController.js

const { calculerBudgetAnnuel } = require("../../services/budgetAnnuelService");
const {
  calculerBudgetAnnuelPedagogique,
} = require("./comptableController");

exports.getBudgetAnnuel = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee, 10) || new Date().getFullYear();
    const anneeScolaire =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      "2025-2026";

    const classeId = req.query.classeId || null;

    if (!req.user || req.user.role !== "comptable") {
      return res
        .status(403)
        .json({ success: false, message: "Accès réservé au comptable." });
    }

    const ecoleId = req.user.ecoleId || null;

    // 1) Calcul global (dépenses, épargne, trésorerie)
    const globalBudget = await calculerBudgetAnnuel(
      annee,
      anneeScolaire,
      ecoleId
    );

    // 2) Calcul pédagogique (attendu élèves, paiements)
    const pedagogique = await calculerBudgetAnnuelPedagogique({
      anneeScolaire,
      annee,
      classeId,
    });

    // 3) Fusion
    const recapMoisFusion = globalBudget.recapMois.map((m) => {
      const ped = (pedagogique.recapMois || []).find(
        (x) => x.mois === m.mois
      );

      return {
        ...m,
        revenusPrevus: ped ? ped.revenusPrevus || 0 : 0,
        revenusReels: ped ? ped.revenusReels || 0 : 0,
      };
    });

    // 4) Totaux revenus
    let totalRevenusPrevus = 0;
    let totalRevenusReels = 0;

    recapMoisFusion.forEach((m) => {
      totalRevenusPrevus += m.revenusPrevus || 0;
      totalRevenusReels += m.revenusReels || 0;
    });

    // 5) Résultat + créances
    const resultatAnnuel =
      totalRevenusReels - (globalBudget.totalDepensesReelles || 0);

    const totalCreancesEleves = Math.max(
      (totalRevenusPrevus || 0) - (totalRevenusReels || 0),
      0
    );

    return res.json({
      success: true,
      annee,
      anneeScolaire,
      recapMois: recapMoisFusion,
      totalRevenusPrevus,
      totalRevenusReels,
      totalDepensesPrevues: globalBudget.totalDepensesPrevues || 0,
      totalDepensesReelles: globalBudget.totalDepensesReelles || 0,
      totalEpargnePrevue: globalBudget.totalEpargnePrevue || 0,
      totalEpargneReelle: globalBudget.totalEpargneReelle || 0,
      resultatAnnuel,
      totalCreancesEleves,
      tresorerieDisponible: globalBudget.tresorerieDisponible || 0,
    });
  } catch (err) {
    console.error("Erreur getBudgetAnnuel fusionné:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors du calcul du budget annuel.",
    });
  }
};
