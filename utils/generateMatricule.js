// ======================================================================
// 🔐 GÉNÉRATION MATRICULE PERMANENT — Gabkut-Schola PRO MAX 2026
// Format : [CYCLE][CLASSE][ECOLE] – [000001]
// Exemple → 0404CLM-000001
//
// 🎯 RÈGLE : le matricule est généré UNE SEULE FOIS dans la vie de l'élève
// ======================================================================

const Eleve = require("../models/Eleve");
const Classe = require("../models/Classe");

const CODE_ECOLE = "CLM"; // Collège Le Mérite

// 🔹 Codes du cycle
const CODES_CYCLE = {
  "Maternelle": "01",
  "Primaire": "02",
  "Secondaire": "03",
  "Collège": "04",
};

// 🔹 Codes des classes
const CODES_CLASSE = {
  "1ère année Maternelle": "01",
  "2ème année Maternelle": "02",
  "3ème année Maternelle": "03",
  "1ère année Primaire": "01",
  "2ème année Primaire": "02",
  "3ème année Primaire": "03",
  "4ème année Primaire": "04",
  "5ème année Primaire": "05",
  "6ème année Primaire": "06",
  "7ème année": "01",
  "8ème année": "02",
  "1ère Littéraire": "01",
  "1ère Scientifiques": "02",
  "1ère Pédagogie": "03",
  "1ère Commerciale et gestion": "04",
  "1ère Coupe et couture": "05",
  "1ère Électricité": "06",
  "1ère Générale": "07",
  "1ère Mécanique Automobile": "08",
  "2ème Commerciale et gestion": "01",
  "2ème Coupe et couture": "02",
  "2ème Électricité": "03",
  "2ème Générale": "04",
  "2ème Mécanique Automobile": "05",
  "2ème Humanité Pédagogique": "06",
  "2ème Humanité Sciences": "07",
  "2ème Humanité Littéraire": "08",
  "3ème Littéraire": "01",
  "3ème Scientifiques": "02",
  "3ème Pédagogie": "03",
  "3ème Commerciale et gestion": "04",
  "3ème Coupe et couture": "05",
  "3ème Électricité": "06",
  "3ème Générale": "07",
  "3ème Mécanique Automobile": "08",
  "4ème Littéraire": "01",
  "4ème Scientifiques": "02",
  "4ème Pédagogie": "03",
  "4ème Commerciale et gestion": "04",
  "4ème Coupe et couture": "05",
  "4ème Électricité": "06",
  "4ème Générale": "07",
  "4ème Mécanique Automobile": "08",
};

module.exports = async function genererMatriculeSecurise(classeId) {
  const classe = await Classe.findById(classeId);
  if (!classe) throw new Error("Classe introuvable pour matricule");

  // 🔥 Détection automatique du cycle
  let cycle = CODES_CYCLE[classe.niveau];
  if (!cycle) {
    if (/Maternelle/i.test(classe.niveau)) cycle = "01";
    else if (/Primaire/i.test(classe.niveau)) cycle = "02";
    else if (/7ème|8ème/i.test(classe.niveau)) cycle = "03";
    else cycle = "04";
  }

  // 🔥 Détection du code classe
  const classeCode = CODES_CLASSE[classe.nom] || "00";

  // 🔥 Numéro permanent — basé uniquement sur total élèves
  const total = await Eleve.countDocuments();
  const ordre = String(total + 1).padStart(6, "0");

  // 🎯 Matricule permanent
  return `${cycle}${classeCode}${CODE_ECOLE}-${ordre}`;
};
