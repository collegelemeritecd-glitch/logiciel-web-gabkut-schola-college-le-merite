// services/budgetMensuelService.js

const DepenseBudget = require("../models/DepenseBudget");
const EcritureComptable = require("../models/comptable/EcritureComptable");

/**
 * Calcule le budget mensuel (prévu + réalisé) pour un mois donné.
 * Retourne :
 *  - budget           (prévisions DepenseBudget)
 *  - totalEncaissements
 *  - totalDecaissements
 *  - soldeMois        (Encaissements - Décaissements)
 */
async function calculerBudgetMensuel(annee, mois, ecoleId, anneeScolaire) {
  const queryBudget = {
    annee,
    mois,
  };
  if (ecoleId) queryBudget.ecoleId = ecoleId;
  if (anneeScolaire) queryBudget.anneeScolaire = anneeScolaire;

  // 1. Lignes de budget (paramétrage prévu)
  const budgetLignes = await DepenseBudget.find(queryBudget).lean();

  // 2. Écritures comptables réelles du mois (journal)
  const dateDebut = new Date(annee, mois - 1, 1, 0, 0, 0);
  const dateFin = new Date(annee, mois, 1, 0, 0, 0);

  const queryEcritures = {
    dateOperation: { $gte: dateDebut, $lt: dateFin },
  };
  // si tu filtres les écritures par école, ajoute un champ ecoleId dans le modèle
  if (ecoleId) queryEcritures.ecoleId = ecoleId;

  const ecritures = await EcritureComptable.find(queryEcritures).lean();

  let totalEncaissements = 0;
  let totalDecaissements = 0;

  /**
   * Hypothèse (classique) :
   * - Comptes de trésorerie = classe 5 (banque, caisse) => compteNumero commence par "5"
   *
   * En compta française :
   *  - Encaissement = augmentation de la trésorerie
   *  - Décaissement = diminution de la trésorerie
   *
   * Ici on fait simple :
   *  - Pour les comptes de trésorerie (classe 5):
   *      * DEBIT  => encaissement (+)
   *      * CREDIT => décaissement (-)
   */
  ecritures.forEach((e) => {
    (e.lignes || []).forEach((l) => {
      const num = l.compteNumero || "";
      if (!num.startsWith("5")) return; // on ne regarde que les comptes de trésorerie

      const montant = Number(l.montant || 0);
      if (l.sens === "DEBIT") {
        totalEncaissements += montant;
      } else if (l.sens === "CREDIT") {
        totalDecaissements += montant;
      }
    });
  });

  const soldeMois = totalEncaissements - totalDecaissements;

  // On renvoie exactement ce que ton front mensuel attend
  const budget = budgetLignes.map((l) => ({
    type: l.type,
    categorie: l.categorie,
    prevu: Number(l.prevu || l.montantPrevu || 0),
    reel: Number(l.reel || l.montantReel || 0),
  }));

  return {
    budget,
    totalEncaissements,
    totalDecaissements,
    soldeMois,
  };
}

module.exports = {
  calculerBudgetMensuel,
};
