// services/BalanceService.js

const EcritureComptable = require("../models/comptable/EcritureComptable");
const Compte = require("../models/comptable/Compte");

/**
 * Classe Actif / Passif par défaut.
 */
function detectClasseBilan(numero) {
  const n = String(numero || "")[0];

  if (n === "1") return "passif"; // capitaux propres / dettes MLT
  if (n === "2") return "actif";  // immobilisations
  if (n === "3") return "actif";  // stocks
  if (n === "4") return "actif";  // tiers (ajusté après selon le signe)
  if (n === "5") return "actif";  // trésorerie

  return "passif";
}

/**
 * Résultat d'exercice via comptes 6 et 7 sur [dateDebut, dateFin],
 * même logique que getCompteResultatChargesProduits (avec report).
 */
async function calculerResultatExercice(dateDebut, dateFin) {
  // 1) SOLDES AVANT PERIODE pour classes 6 et 7
  const lignesAvant = await EcritureComptable.aggregate([
    {
      $match: {
        dateOperation: { $lt: dateDebut },
      },
    },
    { $unwind: "$lignes" },
    {
      $project: {
        compteNumero: "$lignes.compteNumero",
        compteIntitule: "$lignes.compteIntitule",
        sens: "$lignes.sens",
        montant: "$lignes.montant",
      },
    },
    {
      $match: {
        compteNumero: { $ne: null },
        $expr: {
          $or: [
            { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "6"] },
            { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "7"] },
          ],
        },
      },
    },
    {
      $group: {
        _id: "$compteNumero",
        compteIntitule: { $max: "$compteIntitule" },
        totalDebitAvant: {
          $sum: {
            $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
          },
        },
        totalCreditAvant: {
          $sum: {
            $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
          },
        },
      },
    },
  ]);

  const numerosAvant = lignesAvant.map((l) => l._id);
  const comptesRefAvant = await Compte.find({
    numero: { $in: numerosAvant },
  }).lean();
  const mapRefAvant = new Map(
    comptesRefAvant.map((c) => [c.numero, c.intitule || ""])
  );

  const mapAvant = new Map();
  lignesAvant.forEach((l) => {
    const intitule =
      l.compteIntitule && l.compteIntitule.trim()
        ? l.compteIntitule
        : mapRefAvant.get(l._id) || "";

    const soldeAvant = (l.totalDebitAvant || 0) - (l.totalCreditAvant || 0);
    if (Math.abs(soldeAvant) < 0.005) return;

    mapAvant.set(l._id, {
      numero: l._id,
      intitule,
      soldeAvant,
    });
  });

  // 2) MOUVEMENTS DE LA PERIODE
  const lignesPeriode = await EcritureComptable.aggregate([
    {
      $match: {
        dateOperation: { $gte: dateDebut, $lte: dateFin },
      },
    },
    { $unwind: "$lignes" },
    {
      $project: {
        compteNumero: "$lignes.compteNumero",
        compteIntitule: "$lignes.compteIntitule",
        sens: "$lignes.sens",
        montant: "$lignes.montant",
      },
    },
    {
      $match: {
        compteNumero: { $ne: null },
        $expr: {
          $or: [
            { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "6"] },
            { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "7"] },
          ],
        },
      },
    },
  ]);

  const comptesMap = new Map();

  // mouvements période
  for (const l of lignesPeriode) {
    const key = l.compteNumero;
    if (!comptesMap.has(key)) {
      comptesMap.set(key, {
        numero: l.compteNumero,
        intitule: l.compteIntitule || "",
        totalDebit: 0,
        totalCredit: 0,
      });
    }
    const cpt = comptesMap.get(key);
    const montant = l.montant || 0;

    if (l.sens === "DEBIT") cpt.totalDebit += montant;
    else if (l.sens === "CREDIT") cpt.totalCredit += montant;
  }

  // 3) Injecter le report dans la période (comme pour le CR)
  mapAvant.forEach((val, numero) => {
    if (!comptesMap.has(numero)) {
      comptesMap.set(numero, {
        numero,
        intitule: val.intitule,
        totalDebit: 0,
        totalCredit: 0,
      });
    } else if (!comptesMap.get(numero).intitule) {
      comptesMap.get(numero).intitule = val.intitule;
    }

    const cpt = comptesMap.get(numero);
    if (val.soldeAvant > 0) {
      cpt.totalDebit += val.soldeAvant;
    } else if (val.soldeAvant < 0) {
      cpt.totalCredit += -val.soldeAvant;
    }
  });

  // 4) Totaux charges/produits
  let totalCharges = 0;
  let totalProduits = 0;

  for (const cpt of comptesMap.values()) {
    const solde = (cpt.totalDebit || 0) - (cpt.totalCredit || 0);
    if (Math.abs(solde) < 0.005) continue;

    const isCharge = cpt.numero.startsWith("6");
    const isProduit = cpt.numero.startsWith("7");

    if (solde > 0) {
      if (isCharge) totalCharges += solde;
      else if (isProduit) totalProduits += solde;
    } else {
      const soldeAbs = -solde;
      if (isProduit) totalProduits += soldeAbs;
      else if (isCharge) totalCharges += soldeAbs;
    }
  }

  const resultat = totalProduits - totalCharges; // bénéfice > 0, perte < 0

  console.log("BILAN RESULTAT AVEC REPORT", {
    dateDebut,
    dateFin,
    totalCharges,
    totalProduits,
    resultat,
    c6813: comptesMap.get("6813") || null,
  });

  return { totalCharges, totalProduits, resultat };
}

/**
 * Génère le bilan (comptes 1 à 5 + 28) + résultat d'exercice + capital virtuel.
 */
exports.genererBilan = async (type, dateDebut, dateFin) => {
  // 1) Normalisation heures
  dateDebut = new Date(dateDebut);
  dateFin = new Date(dateFin);
  dateDebut.setHours(0, 0, 0, 0);
  dateFin.setHours(23, 59, 59, 999);

  console.log("BILAN GENERATION", { type, dateDebut, dateFin });

  // ---------- A. SOLDES AVANT PERIODE (1–5 + 28) ----------
  const lignesAvant = await EcritureComptable.aggregate([
    {
      $match: {
        dateOperation: { $lt: dateDebut },
      },
    },
    { $unwind: "$lignes" },
    {
      $project: {
        compteNumero: "$lignes.compteNumero",
        compteIntitule: "$lignes.compteIntitule",
        sens: "$lignes.sens",
        montant: "$lignes.montant",
      },
    },
    {
      $match: {
        compteNumero: { $ne: null },
        compteNumero: { $regex: /^(1|2|3|4|5|28)/ },
      },
    },
    {
      $group: {
        _id: "$compteNumero",
        compteIntitule: { $max: "$compteIntitule" },
        totalDebitAvant: {
          $sum: {
            $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
          },
        },
        totalCreditAvant: {
          $sum: {
            $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
          },
        },
      },
    },
  ]);

  const mapAvant = new Map();
  lignesAvant.forEach((l) => {
    const soldeAvant = (l.totalDebitAvant || 0) - (l.totalCreditAvant || 0);
    if (Math.abs(soldeAvant) < 0.005) return;

    mapAvant.set(l._id, {
      numero: l._id,
      intitule: l.compteIntitule || "",
      soldeAvant,
    });
  });

  // ---------- B. MOUVEMENTS DE LA PERIODE (1–5 + 28) ----------
  const lignesPeriode = await EcritureComptable.aggregate([
    {
      $match: {
        dateOperation: { $gte: dateDebut, $lte: dateFin },
        "lignes.compteNumero": { $regex: /^(1|2|3|4|5|28)/ },
      },
    },
    { $unwind: "$lignes" },
    {
      $project: {
        compteNumero: "$lignes.compteNumero",
        compteIntitule: "$lignes.compteIntitule",
        sens: "$lignes.sens",
        montant: "$lignes.montant",
      },
    },
    {
      $match: {
        compteNumero: { $ne: null },
        compteNumero: { $regex: /^(1|2|3|4|5|28)/ },
      },
    },
  ]);

  const mapComptes = new Map();
  let existeCapitalReel = false;

  // mouvements période
  lignesPeriode.forEach((l) => {
    const key = l.compteNumero;
    if (!/^(1|2|3|4|5|28)/.test(String(key || ""))) return;

    if (!mapComptes.has(key)) {
      mapComptes.set(key, {
        numero: l.compteNumero,
        intitule: l.compteIntitule || "",
        totalDebit: 0,
        totalCredit: 0,
      });
    }
    const cpt = mapComptes.get(key);
    const montant = l.montant || 0;

    if (l.sens === "DEBIT") cpt.totalDebit += montant;
    else if (l.sens === "CREDIT") cpt.totalCredit += montant;
  });

  // ---------- C. Compléter intitulés via table Compte ----------
  const numerosTous = Array.from(
    new Set([...mapComptes.keys(), ...mapAvant.keys()])
  );
  if (numerosTous.length) {
    const comptesRef = await Compte.find({
      numero: { $in: numerosTous },
    }).lean();
    const mapRef = new Map(
      comptesRef.map((c) => [c.numero, c.intitule || ""])
    );

    mapComptes.forEach((cpt, num) => {
      if (!cpt.intitule || !cpt.intitule.trim()) {
        cpt.intitule = mapRef.get(num) || "";
      }
    });
    mapAvant.forEach((val, num) => {
      if (!val.intitule || !val.intitule.trim()) {
        val.intitule = mapRef.get(num) || "";
      }
    });
  }

  // ---------- D. Injecter les soldes AVANT comme report ----------
  mapAvant.forEach((val, numero) => {
    if (!mapComptes.has(numero)) {
      mapComptes.set(numero, {
        numero,
        intitule: val.intitule,
        totalDebit: 0,
        totalCredit: 0,
      });
    } else if (!mapComptes.get(numero).intitule) {
      mapComptes.get(numero).intitule = val.intitule;
    }

    const cpt = mapComptes.get(numero);
    if (val.soldeAvant > 0) {
      cpt.totalDebit += val.soldeAvant;
    } else if (val.soldeAvant < 0) {
      cpt.totalCredit += -val.soldeAvant;
    }
  });

  // ---------- E. Construction Actif / Passif ----------
  const comptesBilan = [];
  let totalActif = 0;
  let totalPassif = 0;

  mapComptes.forEach((cpt) => {
    const num = String(cpt.numero || "");
    if (num.startsWith("1")) {
      existeCapitalReel = true;
    }

    const solde = (cpt.totalDebit || 0) - (cpt.totalCredit || 0);
    if (Math.abs(solde) < 0.005) return;

    let classe = detectClasseBilan(cpt.numero);
    const soldeAbs = Math.abs(solde);
    const sens = solde >= 0 ? "DEBIT" : "CREDIT";

    // Ajustement comptes 4 : créance (Actif) / dette (Passif)
    if (num.startsWith("4")) {
      classe = solde > 0 ? "actif" : "passif";
    }

    comptesBilan.push({
      numero: cpt.numero,
      intitule: cpt.intitule,
      solde: soldeAbs,
      sens,
      classe,
    });

    if (classe === "actif") {
      // 28 : amortissements → solde créditeur = diminution de l'actif
      if (num.startsWith("28") && sens === "CREDIT") {
        totalActif -= soldeAbs;
      } else {
        totalActif += soldeAbs;
      }
    } else {
      totalPassif += soldeAbs;
    }
  });

  console.log("BILAN AVANT RESULTAT", {
    totalActif,
    totalPassif,
    compte2833: comptesBilan.find((c) => c.numero === "2833") || null,
  });

  // ---------- F. Résultat (6/7) avec report ----------
  const { totalCharges, totalProduits, resultat } =
    await calculerResultatExercice(dateDebut, dateFin);

  console.log("BILAN RESULTAT FINAL", {
    totalCharges,
    totalProduits,
    resultat,
  });

  if (Math.abs(resultat) >= 0.005) {
    const estBenefice = resultat > 0;

    comptesBilan.push({
      numero: estBenefice ? "131" : "139",
      intitule: estBenefice
        ? "Résultat net : bénéfice"
        : "Résultat net : perte",
      solde: Math.abs(resultat),
      sens: "CREDIT",
      classe: "passif",
    });

    if (estBenefice) {
      totalPassif += Math.abs(resultat);
    } else {
      totalPassif -= Math.abs(resultat);
    }
  }

  // ---------- G. Capital virtuel ----------
  const capitalVirtuel = totalActif - totalPassif;

  if (!existeCapitalReel && Math.abs(capitalVirtuel) >= 0.005) {
    comptesBilan.push({
      numero: "10",
      intitule: "Capital / Équilibre bilan",
      solde: Math.abs(capitalVirtuel),
      sens: "CREDIT",
      classe: "passif",
      _virtuel: true,
    });

    totalPassif += Math.abs(capitalVirtuel);
  }

  // ---------- H. Tri final ----------
  const actif = comptesBilan
    .filter((c) => c.classe === "actif")
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero)));

  const passif = comptesBilan
    .filter((c) => c.classe === "passif")
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero)));

  console.log("BILAN FINAL", {
    totalActif,
    totalPassif,
    resultat,
    compte2833: comptesBilan.find((c) => c.numero === "2833") || null,
    compte10: comptesBilan.find((c) => c.numero === "10") || null,
  });

  return {
    comptesBilan,
    actif,
    passif,
    totalActif,
    totalPassif,
    resultat,
    totalCharges,
    totalProduits,
  };
};
