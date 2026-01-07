/* ============================================================
   📝 GABKUT-ÉCOLE — Enregistrement Activités (PRO MAX 2026)
   ------------------------------------------------------------
   Journal complet de toutes les opérations système
   ============================================================ */

const fs = require("fs");
const path = require("path");

// 🔥 Chemin absolu correct (pas dans functions-serve)
const logsDir = path.join(__dirname, "..", "logs");
const logFile = path.join(logsDir, "activites.log");

// 📁 Créer le dossier logs s'il n'existe pas
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log(`📁 Dossier logs créé : ${logsDir}`);
}

// 📄 Créer le fichier activites.log s'il n'existe pas
if (!fs.existsSync(logFile)) {
  fs.writeFileSync(logFile, "", "utf8");
  console.log(`📄 Fichier activites.log créé : ${logFile}`);
}

/**
 * Enregistre une activité dans le fichier log
 * @param {Object} data - Données de l'activité
 * @param {string} data.type - Type d'activité (Système, Alerte, Info)
 * @param {string} data.nature - Nature de l'opération
 * @param {string} data.details - Détails complets
 * @param {number} [data.montant] - Montant concerné (optionnel)
 * @param {string} [data.classeNom] - Classe concernée (optionnel)
 * @param {string} [data.eleveNom] - Élève concerné (optionnel)
 * @param {string} [data.auteur] - Auteur de l'action (optionnel)
 */
async function enregistrerActivite(data) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ ...data, timestamp }) + "\n";

    // ✅ Protection : utiliser appendFileSync de manière sûre
    try {
      fs.appendFileSync(logFile, logEntry, "utf8");
      console.log(`✅ Activité enregistrée : ${data.type} - ${data.nature}`);
    } catch (writeErr) {
      console.error(`⚠️ Erreur écriture log (tentative recréation) :`, writeErr.message);
      
      // Recréer le dossier et le fichier si nécessaire
      fs.mkdirSync(logsDir, { recursive: true });
      fs.writeFileSync(logFile, logEntry, "utf8");
      console.log(`🔄 Fichier log recréé et entrée écrite`);
    }

  } catch (err) {
    console.error("⚠️ Erreur enregistrement activité :", err.message);
  }
}

module.exports = enregistrerActivite;

console.log(`✅ Module enregistrerActivite chargé — Log: ${logFile}`);
