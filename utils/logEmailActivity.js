// ============================================================
// 🧾 BLOC 12 – LOG AUTOMATIQUE DES ENVOIS D'EMAILS & PAIEMENTS
// ============================================================
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

// 🧩 Modèle de log (si pas encore existant)
const emailLogSchema = new mongoose.Schema({
  reference: String,
  type: { type: String, default: "paiement" },
  destinataire: String,
  sujet: String,
  statut: { type: String, enum: ["succès", "échec"], default: "succès" },
  message: String,
  date: { type: Date, default: Date.now },
});

const EmailLog = mongoose.models.EmailLog || mongoose.model("EmailLog", emailLogSchema);

/**
 * Enregistre une activité e-mail dans la base MongoDB
 * @param {Object} data - { reference, destinataire, sujet, statut, message }
 */
async function logEmailActivity(data) {
  try {
    const log = new EmailLog(data);
    await log.save();
    console.log(`🧾 Log enregistré : ${data.reference} → ${data.destinataire} (${data.statut})`);
  } catch (err) {
    console.error("⚠️ Erreur journalisation e-mail :", err.message);
  }
}

/**
 * Lecture des logs récents pour affichage dans l’admin
 */
async function getRecentEmailLogs(limit = 50) {
  return await EmailLog.find().sort({ date: -1 }).limit(limit);
}

module.exports = { logEmailActivity, getRecentEmailLogs };



