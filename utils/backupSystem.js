/* ======================================================================
   💾 GABKUT-SCHOLA — SYSTÈME DE BACKUP & RESTAURATION
   Version PRO MAX 2025 – Paiements • Élèves • Classes • IA • Logs
====================================================================== */

const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");

const Paiement = require("../models/Paiement");
const Eleve = require("../models/Eleve");
const Classe = require("../models/Classe");

/* Chemin global des backups */
const BACKUP_DIR = path.join(__dirname, "../backups");
fs.ensureDirSync(BACKUP_DIR);

/* Chemin du dossier du jour */
function getBackupFolder() {
  const date = new Date().toISOString().substring(0, 10);
  return path.join(BACKUP_DIR, date);
}

/* ============================================================
   1️⃣ SAUVEGARDE AUTOMATIQUE
============================================================ */
exports.effectuerBackupAutomatique = async () => {
  const folder = getBackupFolder();
  fs.ensureDirSync(folder);

  const data = {
    date: new Date().toISOString(),
    paiements: await Paiement.find(),
    eleves: await Eleve.find(),
    classes: await Classe.find()
  };

  fs.writeFileSync(path.join(folder, "backup.json"), JSON.stringify(data, null, 2));

  // Création ZIP
  await creerFichierZIP(folder);
};

/* ============================================================
   2️⃣ SAUVEGARDE MANUELLE VIA API
============================================================ */
exports.creerBackupManuel = async (req, res) => {
  try {
    await exports.effectuerBackupAutomatique();
    return res.json({ message: "Sauvegarde créée avec succès." });
  } catch (err) {
    console.error("❌ Erreur backup manuel", err);
    return res.status(500).json({ message: "Échec sauvegarde." });
  }
};

/* ZIP Helper */
async function creerFichierZIP(folder) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(folder + ".zip");
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(folder, false);
    archive.finalize();

    output.on("close", resolve);
    archive.on("error", reject);
  });
}

/* ============================================================
   3️⃣ LISTER LES BACKUPS STOCKÉS
============================================================ */
exports.listerBackups = async (req, res) => {
  const list = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".zip"));
  return res.json(list);
};

/* ============================================================
   4️⃣ TÉLÉCHARGER UN BACKUP
============================================================ */
exports.telechargerBackup = async (req, res) => {
  const nom = req.params.nom;
  const filePath = path.join(BACKUP_DIR, nom);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "Backup introuvable." });
  }
  return res.download(filePath);
};

/* ============================================================
   5️⃣ RESTAURATION D’UN BACKUP
============================================================ */
exports.restaurerBackup = async (req, res) => {
  try {
    const nom = req.params.nom.replace(".zip", "");
    const folder = path.join(BACKUP_DIR, nom);
    const file = path.join(folder, "backup.json");

    if (!fs.existsSync(file)) {
      return res.status(404).json({ message: "Fichier backup introuvable." });
    }

    const data = JSON.parse(fs.readFileSync(file));

    // Nettoyage avant restauration
    await Paiement.deleteMany();
    await Eleve.deleteMany();
    await Classe.deleteMany();

    // Restauration
    await Eleve.insertMany(data.eleves);
    await Classe.insertMany(data.classes);
    await Paiement.insertMany(data.paiements);

    return res.json({ message: "Base restaurée avec succès." });

  } catch (err) {
    console.error("❌ Erreur restauration", err);
    return res.status(500).json({ message: "Échec restauration." });
  }
};
