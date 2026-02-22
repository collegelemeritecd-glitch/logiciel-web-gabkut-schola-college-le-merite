/****************************************************************
 📘 SEED COURSES — COLLÈGE LE MÉRITE (sans modifier les classes)
****************************************************************/

const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config();

const Classe = require('./models/Classe');
const Course = require('./models/Course');

const MONGODB_URI = process.env.MONGODB_URI;
const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';
const FILE_PATH = path.join(__dirname, 'data', 'cours.xlsx');

/* ============================================================
   🔧 NORMALIZE (texte)
============================================================ */
const normalize = (text) => {
  if (!text) return '';

  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/\s+/g, " ")            // espaces multiples
    .trim()
    .toLowerCase();
};

/* ============================================================
   🔧 GENERATE ALIAS (libellé Excel → nom classe Mongo)
   Ex: "1re Pdagogie" → "1ere pedagogie"
============================================================ */
const normalizeExcelClassName = (raw) => {
  if (!raw) return '';

  let t = raw.toString();

  // nettoyer les bizarreries de saisie
  t = t.replace(/anne\b/gi, 'année');        // 7me anne -> 7me année
  t = t.replace(/1re/gi, '1ère');
  t = t.replace(/2me/gi, '2ème');
  t = t.replace(/3me/gi, '3ème');
  t = t.replace(/4me/gi, '4ème');
  t = t.replace(/Littraire/gi, 'Littéraire');
  t = t.replace(/Pdagogie/gi, 'Pédagogie');
  t = t.replace(/lectrit/gi, 'Électricité');
  t = t.replace(/Mcanique/gi, 'Mécanique');

  // ne toucher qu’au cas Humanité / Humanitee
  t = t.replace(/Humanitee/gi, 'Humanité');
  t = t.replace(/Humanit(?!é)/gi, 'Humanité');

  // cas bizarres: "4me 4me Pdagogie" -> "4ème Pédagogie"
  t = t.replace(/4me 4me Pdagogie/gi, '4ème Pédagogie');

  // ignorer les valeurs comme "Pour", "8 EB"
  if (/^\s*pour\s*$/i.test(t)) return '';
  if (/^\s*8 EB\s*$/i.test(t)) return '';

  return normalize(t);
};



/* ============================================================
   🚀 SEED FUNCTION
============================================================ */
const seedCourses = async () => {
  try {

    console.log('🌱 Démarrage seed courses...');
    console.log('🔗 MongoDB URI =', MONGODB_URI);
    console.log('📅 Année scolaire des cours =', ANNEE_SCOLAIRE);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    const workbook = xlsx.readFile(FILE_PATH);

    // 1) Charger TOUTES les classes existantes (PAS de filtre sur année)
    const classes = await Classe.find({});
    console.log(`📚 ${classes.length} classes trouvées en base (toutes années confondues)`);

    if (classes.length === 0) {
      console.error('❌ Aucune classe en base. Seed des cours impossible.');
      await mongoose.disconnect();
      process.exit(1);
    }

    // 2) Construire une map normalisée des noms réels
    const classeMap = {}; // key: normalizedName -> Classe
    classes.forEach(c => {
      const key = normalize(c.nom);
      classeMap[key] = c;
    });

    console.log('--- CLASSES DISPONIBLES (clé normalisée -> nom réel) ---');
    Object.keys(classeMap).forEach(k => {
      console.log(`🔑 "${k}"  ->  "${classeMap[k].nom}"`);
    });

    let compteurCrees = 0;
    let compteurExistants = 0;

    // 3) Parcourir toutes les feuilles Excel
    for (const sheetName of workbook.SheetNames) {

      console.log(`\n=== Feuille Excel: ${sheetName} ===`);

      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);

      for (const row of rows) {

        if (!row.COURS || !row.CLASSE) continue;

        const nomCours = row.COURS.toString().trim();
        const classesExcel = row.CLASSE.toString().split(',');

        for (let classeNomBrut of classesExcel) {

          // normalisation côté Excel
          const classeNormExcel = normalizeExcelClassName(classeNomBrut);
          if (!classeNormExcel) {
            console.log(`⚠️ Classe ignorée (vide / alias ignoré) : "${classeNomBrut}"`);
            continue;
          }

          console.log(`🔍 Recherche classe : brute="${classeNomBrut}" => excelNorm="${classeNormExcel}"`);

          // match direct
          let classe = classeMap[classeNormExcel];

          // si pas trouvé, on tente un fallback sur des formes simplifiées
          if (!classe) {
            // ex: "1ere pedagogie" -> "1ere pedagogie" (déjà fait)
            // ici tu peux ajouter des mappings manuels si besoin
          }

          if (!classe) {
            console.log(`❌ Classe non trouvée pour : "${classeNomBrut}" (clé "${classeNormExcel}")`);
            continue;
          }

          // 🔎 Examens / périodes
          const examenS1 =
            row.EXA ||
            row.EX ||
            row.EXA1 ||
            0;

          const examenS2 =
            row['EXA.1'] ||
            row.EXA2 ||
            0;

          const totalS1 =
            row.S1 ||
            ((row.P1 || 0) + (row.P2 || 0) + examenS1);

          const totalS2 =
            row.S2 ||
            ((row.P3 || 0) + (row.P4 || 0) + examenS2);

          const totalGeneral =
            row.TG ||
            (totalS1 + totalS2);

          try {
            await Course.create({
              nom: nomCours,
              classe: classe._id,
              heures: row.H ? row.H.toString().trim() : "0H",
              ponderation: row.PONDERATION || 1,

              semestre1: {
                p1: row.P1 || 0,
                p2: row.P2 || 0,
                examen: examenS1,
                total: totalS1
              },

              semestre2: {
                p3: row.P3 || 0,
                p4: row.P4 || 0,
                examen: examenS2,
                total: totalS2
              },

              totalGeneral,
              // ici on enregistre l'année scolaire sur le cours,
              // mais on ne touche pas aux classes
              anneeScolaire: ANNEE_SCOLAIRE
            });

            console.log(`✅ ${nomCours} - ${classe.nom}`);
            compteurCrees++;

          } catch (err) {
            if (err.code === 11000) {
              compteurExistants++;
              console.log(`ℹ️ Doublon ignoré : ${nomCours} - ${classe.nom}`);
            } else {
              console.error(`❌ Erreur création cours ${nomCours} - ${classe.nom}`, err.message);
            }
          }
        }
      }
    }

    console.log('');
    console.log('🎉 =====================================');
    console.log(`✅ ${compteurCrees} cours créés`);
    console.log(`ℹ️ ${compteurExistants} déjà existants`);
    console.log('🎉 =====================================');
    console.log('');

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error('❌ Erreur seedCourses:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

seedCourses();
