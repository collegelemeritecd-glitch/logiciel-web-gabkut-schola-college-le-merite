// scripts/seed-teachers.js
/************************************************************
 📘 GABKUT SCHOLA — SEED ENSEIGNANTS (USER + ENSEIGNANT)
 - Lit PERSONNEL.docx + ATRIBUTION-DES-COURS-PROF.xlsx + COURS-ENSEIGNANTS-PRIMAIRE.xlsx
 - Crée les comptes User (role: teacher) + documents Enseignant
*************************************************************/

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
require('dotenv').config();
const { nanoid } = require('nanoid');

const User = require('../models/User');
const Enseignant = require('../models/Enseignant');

const MONGODB_URI = process.env.MONGODB_URI;
const SCHOOL_YEAR = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

function buildPasswordFromName(fullName) {
  const base = (fullName || 'prof')
    .split(' ')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return `${base}123`;
}

/* ============================================================
   1️⃣ Récupérer les profs depuis PERSONNEL.docx (optionnel)
============================================================ */

async function extractTeachersFromPersonnel(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const buffer = fs.readFileSync(filePath);
  const { value } = await mammoth.extractRawText({ buffer });

  const lines = value.split('\n').map(l => l.trim()).filter(Boolean);

  const teachers = [];

  for (const line of lines) {
    const matchEmail = line.match(/([\w.-]+@collegelemerite\.school)/i);
    if (matchEmail) {
      const email = matchEmail[1].toLowerCase();
      const namePart = line.replace(matchEmail[0], '').trim();
      if (!namePart) continue;

      const fullName = namePart
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

      teachers.push({ fullName, email });
    }
  }

  return teachers;
}

/* ============================================================
   2️⃣ Professeurs depuis les Excel (noms)
============================================================ */

function extractTeacherNamesFromExcels() {
  const baseDir = path.join(__dirname, '..', 'data');

  const secondaryPath = path.join(baseDir, 'ATRIBUTION-DES-COURS-PROF.xlsx');
  const primaryPath = path.join(baseDir, 'COURS-ENSEIGNANTS-PRIMAIRE.xlsx');

  const names = new Set();

  // SECONDARY
  if (fs.existsSync(secondaryPath)) {
    const wb = XLSX.readFile(secondaryPath);
    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      rows.forEach(row => {
        const teacherName = row.NOM || row.Nom || row.Prof || row.ENSEIGNANT;
        if (teacherName) {
          names.add(String(teacherName).trim());
        }
      });
    });
  }

  // PRIMARY
  if (fs.existsSync(primaryPath)) {
    const wb = XLSX.readFile(primaryPath);
    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      rows.forEach(row => {
        const teacherName = row['NOM POSTNOM PRENOM'] || row.NOM || row.Nom;
        if (teacherName) {
          names.add(String(teacherName).trim());
        }
      });
    });
  }

  return Array.from(names);
}

/* ============================================================
   3️⃣ Déduction email à partir du nom
============================================================ */

function guessEmailFromName(name) {
  const upper = name.toUpperCase();

  // mappings explicites (cohérents avec TEACHER_NAME_TO_EMAIL)
  if (upper === 'CLEMENT KADIAYI') return 'clement.kadiayi@collegelemerite.school';
  if (upper === 'NGOY WA NGOY DECABLOT') return 'decablot.ngoy@collegelemerite.school';
  if (upper === 'BEYA TSHILENGE GABRIEL') return 'beya.gabriel@collegelemerite.school';
  if (upper === 'KADJIBA KYUNGU AUGUSTIN') return 'augustin.kadjiba@collegelemerite.school';
  if (upper === 'MBUYAMBA MOLOWAYI FABRICE') return 'fabrice.mbuyamba@collegelemerite.school';
  if (upper === 'MBATSHI SHAMASHANGA CHRISTIN') return 'christin.mbatshi@collegelemerite.school';
  if (upper === 'MUNUNG PIMAKO JACKSON') return 'jackson.munung@collegelemerite.school';
  if (upper === 'NTUMBA MBOWA JOSEPH') return 'joseph.ntumba@collegelemerite.school';
  if (upper === 'BALTHAZAR') return 'balthazar@collegelemerite.school';
  if (upper === 'NICLETTE NSAMBA') return 'nicollette.nsamba@collegelemerite.school';
  if (upper === 'CLEMENTINE NGALULA') return 'clementine.ngalula@collegelemerite.school';
  if (upper === 'JUDITH NJIBA') return 'judith.njiba@collegelemerite.school';
  if (upper === 'PAUL MEMBA') return 'paul.memba@collegelemerite.school';
  if (upper === 'LEDOUX KABWE') return 'ledoux.kabwe@collegelemerite.school';
  if (upper === 'JUNIOR JOEL NGANDU') return 'joel.ngandu@collegelemerite.school';
  if (upper.startsWith('MARCEL')) return 'marcel@collegelemerite.school';

  if (upper === 'CELESTIN MBAYA') return 'celestin.mbaya@collegelemerite.school';
  if (upper === 'WAGUMIA VICTORINE') return 'wagumia.victorine@collegelemerite.school';
  if (upper === 'MBELU NGANDU ADA') return 'mbelu.ngandu@collegelemerite.school';
  if (upper === 'JONAS KONGOLO') return 'jonas.kongolo@collegelemerite.school';
  if (upper === 'RICHARD TSHIBANGU') return 'richard.tshibangu@collegelemerite.school';
  if (upper.includes('MBUYI NGANDU')) return 'mbuyi.ngandu@collegelemerite.school';
  if (upper === 'GEDEON KABAMBA') return 'gedeon.kabamba@collegelemerite.school';

  // fallback générique prenom.nom
  const parts = upper.split(' ').filter(Boolean);
  if (!parts.length) return null;
  const prenom = parts[parts.length - 1];
  const nom = parts[0];
  const emailBase = `${prenom.toLowerCase()}.${nom.toLowerCase()}@collegelemerite.school`;
  return emailBase;
}

/* ============================================================
   4️⃣ MAIN
============================================================ */

async function main() {
  try {
    console.log('🌱 Seed enseignants (User + Enseignant)...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    const dataDir = path.join(__dirname, '..', 'data');
    const personnelPath = path.join(dataDir, 'PERSONNEL.docx');

    const teachersFromDoc = await extractTeachersFromPersonnel(personnelPath);
    const namesFromExcels = extractTeacherNamesFromExcels();

    const byEmail = new Map();

    // D’abord ceux qui viennent de PERSONNEL.docx (avec email explicite)
    teachersFromDoc.forEach(t => {
      if (t.email) byEmail.set(t.email.toLowerCase(), t.fullName);
    });

    // Ensuite les noms des Excel -> emails déduits
    namesFromExcels.forEach(name => {
      const fullName = String(name).replace(/\s+/g, ' ').trim();
      const email = guessEmailFromName(fullName);
      if (!email) return;
      const key = email.toLowerCase();
      if (byEmail.has(key)) return;
      byEmail.set(key, fullName);
    });

    const toCreate = [];
    for (const [email, fullName] of byEmail.entries()) {
      toCreate.push({ email, fullName });
    }

    console.log(`👨‍🏫 Professeurs détectés: ${toCreate.length}`);

    let created = 0;
    let existing = 0;

    for (const prof of toCreate) {
      const existingUser = await User.findOne({ email: prof.email.toLowerCase() });
      if (existingUser) {
        existing++;
        continue;
      }

      const tempPassword = buildPasswordFromName(prof.fullName);

      const user = await User.create({
        fullName: prof.fullName.toUpperCase(),
        email: prof.email.toLowerCase(),
        role: 'teacher',
        password: tempPassword,
        isActive: true,
      });

      const timePart = Date.now().toString().slice(-5);
      const randomPart = nanoid(3).toUpperCase();
      const matricule = `T-${timePart}-${randomPart}`;

      await Enseignant.create({
        nom: prof.fullName.toUpperCase(),
        email: prof.email.toLowerCase(),
        user: user._id,
        anneeScolaire: SCHOOL_YEAR,
        matricule,
      });

      console.log(`✅ User enseignant créé: ${prof.fullName} <${prof.email}> / mdp: ${tempPassword}`);
      created++;
    }

    console.log('🎉 Seed enseignants terminé.');
    console.log(`   Créés   : ${created}`);
    console.log(`   Existant: ${existing}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-teachers:', err);
    process.exit(1);
  }
}

main();
