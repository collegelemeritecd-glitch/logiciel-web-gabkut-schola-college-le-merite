/* ============================================================================
 📦 GABKUT-ÉCOLE — EXPORT DOCUMENTS ZIP (PRO MAX 2026)
 ------------------------------------------------------------------------------
 Génère un ZIP des documents filtrés par :
 - année
 - classe
 - élève
 - type (financial, academic, identity, other)
============================================================================= */

const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const Document = require("../models/Document");

module.exports = async function exportDocuments(filters = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const query = {};

      if (filters.annee && filters.annee !== "toutes")
        query.annee = filters.annee;

      if (filters.classe && filters.classe !== "toutes")
        query.classe = filters.classe;

      if (filters.type && filters.type !== "tous")
        query.type = filters.type;

      if (filters.eleve)
        query.eleve = new RegExp(filters.eleve, "i");

      const docs = await Document.find(query).lean();
      if (!docs.length) return reject("Aucun document à exporter");

      // Date + nom ZIP
      const stamp = Date.now();
      const zipName = `gabkut-documents-${stamp}.zip`;
      const zipPath = path.join(__dirname, "..", "temp", zipName);

      // Créer dossier temp s'il n'existe pas
      if (!fs.existsSync(path.join(__dirname, "..", "temp"))) {
        fs.mkdirSync(path.join(__dirname, "..", "temp"));
      }

      // Flux de création ZIP
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      archive.pipe(output);

      // Structure des dossiers internes
      for (const doc of docs) {
        const folder =
          `${doc.annee || "ANNEE-NC"}` +
          "/" +
          `${doc.classe || "CLASSE-NC"}` +
          "/" +
          `${doc.eleve || "ELEV-NC"}`;

        const safeName = `${doc.nom}.${doc.path.split(".").pop()}`;

        if (fs.existsSync(doc.path)) {
          archive.file(doc.path, {
            name: `${folder}/${safeName}`
          });
        }
      }

      archive.finalize();

      output.on("close", () => resolve(zipPath));
      archive.on("error", err => reject(err));

    } catch (err) {
      reject(err);
    }
  });
};
