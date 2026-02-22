/************************************************************
 📘 GABKUT SCHOLA — SEED TEACHER COURSES
 Collège Le Mérite - Backend Node.js
 - Importe cours.xlsx (primaire + secondaire/technique)
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
  findCollegeClassesByYear,
} = require('../helpers/teacherMapping');

const MONGODB_URI = process.env.MONGODB_URI;
const SCHOOL_YEAR = '2025-2026';
const SCHOOL_ID = null;

/* ============================================================
   🔧 SPLIT CLASSES: "1ère Littéraire, 1ère Scientifiques" → array
============================================================ */
function splitAndNormalizeClasses(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map(c => c.trim())
    .filter(c => c.length > 0);
}

/* ============================================================
   🔧 IMPORT (SECONDARY / PRIMARY MODE)
============================================================ */
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
      let classNameRaw;

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
        classNameRaw = lastClassName;

        discipline =
          row.DISCIPLINE ||
          row.COURS ||
          row['COURS CLASSE'] ||
          row['COURS 1ere B'];
      } else if (mode === 'PRIMARY') {
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

        const upSheet = sheetName.toUpperCase();
        if (upSheet.includes('1ERE PRIMAIRE') || upSheet.includes('1ERE  PRIMAIRE')) {
          classNameRaw = '1 PRIM';
        } else if (upSheet.includes('2ÈME PRIMAIRE') || upSheet.includes('2EME PRIMAIRE')) {
          classNameRaw = '2 PRIM';
        } else if (upSheet.includes('3EME PRIMAIRE') || upSheet.includes('3ÈME PRIMAIRE')) {
          classNameRaw = '3 PRIM';
        } else if (upSheet.includes('4EME PRIMAIRE') || upSheet.includes('4ÈME PRIMAIRE')) {
          classNameRaw = '4 PRIM';
        } else if (upSheet.includes('5EME PRIMAIRE') || upSheet.includes('5ÈME PRIMAIRE')) {
          classNameRaw = '5 PRIM';
        } else if (upSheet.includes('6EME PRIMAIRE') || upSheet.includes('6ÈME PRIMAIRE')) {
          classNameRaw = '6 PRIM';
        }
      }

      if (!teacherName || !discipline || !classNameRaw) {
        continue;
      }

      const teacherUser = await findTeacherUserByName(teacherName);
      if (!teacherUser) continue;

      const classNameTrim = String(classNameRaw).trim();
      const upClass = classNameTrim.toUpperCase();

      const isTous =
        upClass.includes('TOUS') || upClass.includes('TOUTES');

      // Gestion "TOUS" (1 TOUS, 2 TOUS...)
      if (isTous && mode === 'SECONDARY') {
        let yearNumber = null;

        if (upClass.startsWith('1')) yearNumber = 1;
        else if (upClass.startsWith('2')) yearNumber = 2;
        else if (upClass.startsWith('3')) yearNumber = 3;
        else if (upClass.startsWith('4')) yearNumber = 4;

        if (!yearNumber) {
          console.warn('⚠️ [SEED] Classe TOUS non reconnue:', classNameTrim);
          continue;
        }

        const classesYear = await findCollegeClassesByYear(yearNumber);
        if (!classesYear.length) {
          console.warn('⚠️ [SEED] Aucune classe Collège trouvée pour niveau:', yearNumber);
          continue;
        }

        const weight = row.PONDERATION || row['PONDERATION'] || 0;
        const periodsLabel = 'P1-P6 / EX';

        for (const classe of classesYear) {
          const { optionCode, optionLabel } = inferOptionFromClassName(classe.nom || classe.name);

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
              className: classe.nom || classe.name || classNameTrim,
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

        continue;
      }

      // Ici on peut avoir plusieurs classes séparées par virgule
      const classesList = splitAndNormalizeClasses(classNameTrim);

      for (const singleClass of classesList) {
        const classe = await findClasseByName(singleClass);
        if (!classe) continue;

        const { optionCode, optionLabel } = inferOptionFromClassName(classe.nom || classe.name);
        const weight = row.PONDERATION || row['PONDERATION'] || 0;
        const periodsLabel = 'P1-P6 / EX';

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
            className: classe.nom || classe.name || singleClass,
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
  }

  return { totalRecords, bulkOps };
}

/* ============================================================
   🚀 MAIN
============================================================ */
async function main() {
  try {
    console.log('🌱 Seed TeacherCourse (cours.xlsx unique)...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    const secondaryPath = path.join(__dirname, '..', 'data', 'cours.xlsx');

    const allBulkOps = [];
    let grandTotal = 0;

    const sec = await importAttributionsFromFile(secondaryPath, 'SECONDARY');
    allBulkOps.push(...sec.bulkOps);
    grandTotal += sec.totalRecords;

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
