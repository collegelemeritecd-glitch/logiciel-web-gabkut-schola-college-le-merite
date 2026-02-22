// services/budgetUtils.js
const EcritureComptable = require("../models/comptable/EcritureComptable");

/**
 * Calcule le "reel" pour chaque ligne de DepenseBudget d'un mois donné,
 * en fonction de comptesPrefixes.
 *
 * @param {Number} annee
 * @param {Number} mois   // 1-12
 * @param {Array} lignesBudget  // docs DepenseBudget pour ce mois
 * @returns {Promise<Array>} mêmes lignes avec propriété reel calculée
 */
async function injecterReelDepuisComptesPrefixes(annee, mois, lignesBudget) {
  const dateFrom = new Date(annee, mois - 1, 1, 0, 0, 0, 0);
  const dateTo = new Date(annee, mois, 0, 23, 59, 59, 999);

  const ecrituresDuMois = await EcritureComptable.aggregate([
    {
      $match: {
        dateOperation: { $gte: dateFrom, $lte: dateTo },
      },
    },
    { $unwind: "$lignes" },
    {
      $project: {
        compteNumero: "$lignes.compteNumero",
        sens: "$lignes.sens",
        montant: "$lignes.montant",
        typeOperation: "$typeOperation",
      },
    },
  ]);

  return lignesBudget.map((l) => {
    const prefixes = Array.isArray(l.comptesPrefixes) ? l.comptesPrefixes : [];

    if (!prefixes.length) {
      const reelAncien =
        typeof l.reel === "number" ? l.reel : l.montantReel || 0;
      return { ...l, reel: reelAncien };
    }

    let totalReel = 0;

    ecrituresDuMois.forEach((e) => {
      if (!e.compteNumero) return;
      const match = prefixes.some((p) => e.compteNumero.startsWith(p));
      if (!match) return;

      // On considère les dépenses = crédits des comptes mappés
      if (e.sens === "CREDIT") {
        totalReel += e.montant || 0;
      }
    });

    return {
      ...l,
      reel: totalReel,
    };
  });
}

module.exports = { injecterReelDepuisComptesPrefixes };
