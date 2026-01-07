// ======================================================================
// ⚡ RECALCUL GLOBAL — ÉLÈVES (PRO MAX 2026 — FUSION TURBO + BULKWRITE)
// Recalcule montantPaye, montantDu, moisPayes pour TOUS les élèves
// en arrière-plan, sans ralentir l'API.
// ======================================================================

const Eleve = require("../models/Eleve");
const Paiement = require("../models/Paiement");

let isRunning = false; // ⛔ empêche recalcul simultané

module.exports = async function recalculateEleves() {
  if (isRunning) return; // 🔥 turbo protection
  isRunning = true;

  try {
    // 1️⃣ Récupérer élèves + paiements
    const eleves = await Eleve.find().populate("classe", "montantFrais").lean();
    const paiements = await Paiement.find().lean();

    // 2️⃣ Indexation des paiements par élève
    const map = {};
    for (const p of paiements) {
      if (!map[p.eleveId]) map[p.eleveId] = [];
      map[p.eleveId].push(p);
    }

    // 3️⃣ Construction des opérations bulk
    const ops = eleves.map(e => {
      const list = map[e._id] || [];
      const totalPaye = list.reduce((s, p) => s + (p.montant || 0), 0);
      const moisPayes = [...new Set(list.map(p => p.mois))];
      const montantDu = Number(e.classe?.montantFrais || 0) - totalPaye;

      return {
        updateOne: {
          filter: { _id: e._id },
          update: { montantPaye: totalPaye, montantDu, moisPayes }
        }
      };
    });

    // 4️⃣ Execution bulk optimisée
    if (ops.length) await Eleve.bulkWrite(ops);

    console.log(`🔄 Recalcul Turbo ✔ | ${ops.length} élèves synchronisés`);

  } catch (err) {
    console.error("❌ Erreur recalcul élèves :", err);
  }

  isRunning = false; // 🔓 libération turbo
};
