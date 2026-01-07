/**
 * ============================================================================
 * 🤖 IA-3 — SYNCHRONISATION FINANCIÈRE DES ÉLÈVES
 * Analyse intelligente après chaque paiement (paiement créé ou modifié)
 * ============================================================================
 */

const Eleve = require("../../models/Eleve");
const Activite = require("../../models/Activite"); // journal IA
const dotenv = require("dotenv");
dotenv.config();

/**
 * 🔥 synchroniserIA3(paiement)
 * Met à jour le profil élève + journal IA + alertes si irrégularités
 */
exports.synchroniserIA3 = async function (paiement) {
  try {
    if (!paiement || !paiement.eleveId) return;

    const eleve = await Eleve.findById(paiement.eleveId);
    if (!eleve) return;

    // ===========================
    // 1️⃣ Statut financier
    // ===========================
    const seuil = eleve.fraisTotal || eleve.fraisScolaire || 0;
    const montantPaye = eleve.montantPaye || 0;
    const solde = seuil - montantPaye;

    let statut = "À jour";
    if (solde > 0) statut = "En retard";
    if (solde < 0) statut = "Avance";

    // ===========================
    // 2️⃣ Prévisions mensuelles
    // ===========================
    const nbMois = eleve.moisPayes?.length || 0;
    const progression = seuil > 0 ? Math.min(((montantPaye / seuil) * 100), 100) : 0;

    // ===========================
    // 3️⃣ IA Profil de risque
    // ===========================
    let risque = "Faible";
    if (solde > 0 && progression < 50) risque = "Moyen";
    if (solde > 0 && progression < 25) risque = "Élevé";

    // ===========================
    // 4️⃣ Mise à jour de l'élève
    // ===========================
    eleve.statutPaiement = statut;
    eleve.risque = risque;
    eleve.progressionFinanciere = progression;
    eleve.soldeFinancier = solde;
    await eleve.save();

    // ===========================
    // 5️⃣ Journal IA (Historique)
    // ===========================
    await Activite.create({
      type: "IA3_SYNCHRO",
      eleve: eleve.nom,
      classe: eleve.classe?.nom || eleve.classeNom,
      referencePaiement: paiement.reference,
      montant: paiement.montant,
      statut,
      progression,
      risque,
      date: new Date()
    });

    // ===========================
    // 6️⃣ Alertes automatiques
    // ===========================
    if (risque === "Élevé") {
      console.log(`🚨 IA — Risque financier élevé détecté pour ${eleve.nom}`);
    }

    console.log(`🤖 IA-3 synchronisée : ${eleve.nom} (${statut})`);
    return true;

  } catch (err) {
    console.error("❌ Erreur IA-3 :", err);
    return false;
  }
};
