// scripts/seed-teacher-courses.js
/************************************************************
 📘 GABKUT SCHOLA — SEED TEACHER COURSES
 Collège Le Mérite - Backend Node.js
 - Importe ATRIBUTION-DES-COURS-PROF.xlsx (secondaire/technique)
 - Importe COURS-ENSEIGNANTS-PRIMAIRE.xlsx (primaire)
 - Crée TeacherCourse par enseignant / classe / discipline
*************************************************************/

const mongoose = require('mongoose');
const path = require('path');
const XLSX = require('xlsx');
require('dotenv').config();

const TeacherCourse = require('../models/TeacherCourse');
const {
  findTeacherUserByName,
  findClasseByName,
  inferOptionFromClassName,
} = require('../helpers/teacherMapping');

const MONGODB_URI = process.env.MONGODB_URI;
const SCHOOL_YEAR = '2025-2026';
const SCHOOL_ID = null; // si tu as un model School, tu peux le lier ici

async function importAttributionsFromFile(filePath, mode) {
  console.log('📄 Fichier:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log('📑 Onglets trouvés:', sheetNames.join(', '));

  let totalRecords = 0;
  const bulkOps = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) continue;

    console.log(`🔎 Lecture onglet: ${sheetName} (${rows.length} lignes)`);

        let lastTeacherName = null;
    let lastClassName = null;

    for (const row of rows) {
      let teacherName;
      let discipline;
      let className;

      if (mode === 'SECONDARY') {
        const rawName = row.NOM || row.Nom || row.Prof || row.ENSEIGNANT;
        if (rawName && String(rawName).trim() !== '') {
          lastTeacherName = String(rawName).trim();
        }
        teacherName = lastTeacherName;

        const rawClass = row.CLASSE || row['CLASSE'] || row['Classe'];
        if (rawClass && String(rawClass).trim() !== '') {
          lastClassName = String(rawClass).trim();
        }
        className = lastClassName;

        discipline =
          row.DISCIPLINE ||
          row.COURS ||
          row['COURS CLASSE'] ||
          row['COURS 1ere B'];
     


        className =
          row.CLASSE ||
          row['CLASSE'] ||
          row['Classe'];

      } else if (mode === 'PRIMARY') {
        // ====== FICHIER COURS-ENSEIGNANTS-PRIMAIRE.xlsx ======
        // Chaque onglet = un instituteur + une classe (1ère, 2ème ...)
        // Exemple de colonnes: "NOM POSTNOM PRENOM", "DISCIPLINE", "PONDERATION"...
        const rawName = row['NOM POSTNOM PRENOM'] || row.NOM || row.Nom;
        if (rawName && String(rawName).trim() !== '') {
          lastTeacherName = String(rawName).trim();
        }
        teacherName = lastTeacherName;

        discipline =
          row.DISCIPLINE ||
          row['COURS / 1ere B'] ||
          row['COURS / 2 eme'] ||
          row['COURS / 3eme'] ||
          row['COURS / 4eme'];

        // Classe : on se base sur le nom de l’onglet
        // ex: "CELESTIN MBAYA 1ERE PRIMAIRE"
        const upSheet = sheetName.toUpperCase();
        if (upSheet.includes('1ERE PRIMAIRE') || upSheet.includes('1ERE  PRIMAIRE')) {
          className = '1 PRIM';
        } else if (upSheet.includes('2ÈME PRIMAIRE') || upSheet.includes('2EME PRIMAIRE')) {
          className = '2 PRIM';
        } else if (upSheet.includes('3EME PRIMAIRE') || upSheet.includes('3ÈME PRIMAIRE')) {
          className = '3 PRIM';
        } else if (upSheet.includes('4EME PRIMAIRE') || upSheet.includes('4ÈME PRIMAIRE')) {
          className = '4 PRIM';
        } else if (upSheet.includes('5EME PRIMAIRE') || upSheet.includes('5ÈME PRIMAIRE')) {
          className = '5 PRIM';
        } else if (upSheet.includes('6EME PRIMAIRE') || upSheet.includes('6ÈME PRIMAIRE')) {
          className = '6 PRIM';
        }
      }

      // Si toujours pas de prof ou pas de discipline/classe → on saute
      if (!teacherName || !discipline || !className) {
        continue;
      }

      const teacherUser = await findTeacherUserByName(teacherName);
      if (!teacherUser) continue;

      const classe = await findClasseByName(className);
      if (!classe) continue;

      const { optionCode, optionLabel } = inferOptionFromClassName(classe.nom || classe.name);

      const weight = row.PONDERATION || row['PONDERATION'] || 0;

      let periodsLabel = 'P1-P6 / EX';
      const hasP1 = row.P1 || row['P1'] !== undefined;
      if (hasP1) {
        periodsLabel = 'P1-P6 / EX';
      }

      const filter = {
        teacher: teacherUser._id,
        classId: classe._id,
        subjectName: String(discipline).trim(),
        schoolYear: SCHOOL_YEAR,
      };

      const update = {
        $set: {
          teacher: teacherUser._id,
          classId: classe._id,
          className: classe.nom || classe.name || className,
          subjectName: String(discipline).trim(),
          optionCode,
          optionLabel,
          weight: Number(weight) || 0,
          periodsLabel,
          schoolYear: SCHOOL_YEAR,
          schoolId: SCHOOL_ID,
        },
      };

      bulkOps.push({
        updateOne: {
          filter,
          update,
          upsert: true,
        },
      });

      totalRecords++;
    }
  }

  return { totalRecords, bulkOps };
}

async function main() {
  try {
    console.log('🌱 Seed TeacherCourse (primaire + secondaire)...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    const secondaryPath = path.join(__dirname, '..', 'data', 'ATRIBUTION-DES-COURS-PROF.xlsx');
    const primaryPath = path.join(__dirname, '..', 'data', 'COURS-ENSEIGNANTS-PRIMAIRE.xlsx');

    const allBulkOps = [];
    let grandTotal = 0;

    // Secondaire / technique
    const sec = await importAttributionsFromFile(secondaryPath, 'SECONDARY');
    allBulkOps.push(...sec.bulkOps);
    grandTotal += sec.totalRecords;

    // Primaire
    const prim = await importAttributionsFromFile(primaryPath, 'PRIMARY');
    allBulkOps.push(...prim.bulkOps);
    grandTotal += prim.totalRecords;

    if (!allBulkOps.length) {
      console.log('⚠️ Aucun enregistrement trouvé à partir des Excel.');
    } else {
      console.log(`🧮 ${grandTotal} attributions à synchroniser...`);
      const res = await TeacherCourse.bulkWrite(allBulkOps);
      console.log('✅ bulkWrite TeacherCourse terminé:');
      console.log('   Matched  :', res.matchedCount);
      console.log('   Upserted :', res.upsertedCount);
      console.log('   Modified :', res.modifiedCount);
    }

    console.log('🎉 Seed TeacherCourse terminé.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-teacher-courses:', err);
    process.exit(1);
  }
}

main();
