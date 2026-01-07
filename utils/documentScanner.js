const fs = require("fs");
const path = require("path");
const Document = require("../models/Document");

// Extensions supportées
const SUPPORTED = [".pdf", ".doc", ".docx", ".xlsx", ".xls", ".csv", ".zip"];

// Dossiers de départ (root scanning)
const ROOT_DIR = path.resolve(__dirname, ".."); // backend root

async function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // 🟣 Si c'est un dossier → scan récursif
    if (entry.isDirectory()) {
      try {
        await scanDirectory(fullPath);
      } catch (e) {}
      continue;
    }

    // 🟢 Si c'est un fichier → vérifier extension
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED.includes(ext)) continue;

    // Nom du fichier sans extension
    const baseName = entry.name.replace(ext, "");

    // Si le document est déjà dans MongoDB
    const exist = await Document.findOne({ path: fullPath });

    if (!exist) {
      // console.log(`📄 Nouveau document détecté → ${file}`); // LOG désactivé


      // Classification automatique
      let type = "other";
      const name = entry.name.toLowerCase();
      if (name.includes("reçu") || name.includes("paiement") || name.includes("facture"))
        type = "financial";
      else if (
        name.includes("bulletin") ||
        name.includes("attestation") ||
        name.includes("certificat")
      )
        type = "academic";
      else if (name.includes("carte") || name.includes("identite") || name.includes("identity"))
        type = "identity";

      await Document.create({
        nom: baseName,
        reference: baseName,
        type,
        path: fullPath,
      });
    }
  }
}

/* 🚀 Lancement du scan global */
async function scanAllDocuments() {
  console.log("🔎 Scan global des documents…");
  try {
    await scanDirectory(ROOT_DIR); // dossier backend complet
    console.log("✅ Scan terminé — tous les documents ont été indexés.");
  } catch (err) {
    console.error("❌ Erreur lors du scan documents :", err);
  }
}

module.exports = scanAllDocuments;
