const mongoose = require('mongoose');
const User = require('../models/User');
const Classe = require('../models/Classe');

/************************************************************
 📘 GABKUT SCHOLA — HELPER MAPPING PROF / CLASSE / OPTION
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500

 - Mappe un nom Excel → User (role: "teacher")
 - Récupère une Classe par son nom (champ "nom" de ton modèle)
 - Déduit optionCode / optionLabel à partir du nom de la classe

 ⚠️ VERSION PROD:
   ➜ Chaque prof Excel est mappé à son email @collegelemerite.school
*************************************************************/

/* ============================================================
   1️⃣ MAPPING PROF EXCEL → EMAIL USER
============================================================ */

const TEACHER_NAME_TO_EMAIL = {
  // Secondaire / technique (ATRIBUTION-DES-COURS-PROF.xlsx)
  'CLEMENT KADIAYI': 'clement.kadiayi@collegelemerite.school',
  'NGOY WA NGOY DECABLOT': 'decablot.ngoy@collegelemerite.school',
  'BEYA TSHILENGE GABRIEL': 'beya.gabriel@collegelemerite.school',
  'KADJIBA KYUNGU AUGUSTIN': 'augustin.kadjiba@collegelemerite.school',
  'MBUYAMBA MOLOWAYI FABRICE': 'fabrice.mbuyamba@collegelemerite.school',
  'MBATSHI SHAMASHANGA CHRISTIN': 'christin.mbatshi@collegelemerite.school',
  'MUNUNG PIMAKO JACKSON': 'jackson.munung@collegelemerite.school',
  'NTUMBA MBOWA JOSEPH': 'joseph.ntumba@collegelemerite.school',
  'BALTHAZAR': 'balthazar@collegelemerite.school',
  'NICLETTE NSAMBA': 'nicollette.nsamba@collegelemerite.school',
  'CLEMENTINE NGALULA': 'clementine.ngalula@collegelemerite.school',
  'JUDITH NJIBA': 'judith.njiba@collegelemerite.school',
  'PAUL MEMBA': 'paul.memba@collegelemerite.school',
  'LEDOUX KABWE': 'ledoux.kabwe@collegelemerite.school',
  'Junior Joel NGANDU': 'joel.ngandu@collegelemerite.school',
  'Marcel': 'marcel@collegelemerite.school',

  // Primaire (COURS-ENSEIGNANTS-PRIMAIRE.xlsx)
  // ➜ adapte les emails comme tu veux, l’important est la cohérence avec User
  'CELESTIN MBAYA': 'celestin.mbaya@collegelemerite.school',     // 1ère Prim A
  'WAGUMIA VICTORINE': 'wagumia.victorine@collegelemerite.school', // 1ère Prim B
  'MBELU NGANDU ADA': 'mbelu.ngandu@collegelemerite.school',     // 2ème Prim
  'JONAS KONGOLO': 'jonas.kongolo@collegelemerite.school',       // 3ème Prim
  'RICHARD TSHIBANGU': 'richard.tshibangu@collegelemerite.school', // 4ème Prim
  'MBUYI NGANDU MICHELLINE': 'mbuyi.ngandu@collegelemerite.school', // 5ème Prim
  'GEDEON KABAMBA': 'gedeon.kabamba@collegelemerite.school', // 6ème Primaire
  // ... ajoute ici l’instituteur de 6ème primaire si tu l’as dans le fichier
};

/* ============================================================
   2️⃣ CACHES
============================================================ */

const userCache = new Map();
const classeCache = new Map();

/* ============================================================
   3️⃣ FONCTION: trouver un enseignant à partir du nom Excel
============================================================ */

async function findTeacherUserByName(rawName) {
  if (!rawName) return null;

  const keyExact = String(rawName).trim();

  if (userCache.has(keyExact)) return userCache.get(keyExact);

  const mappedEmail = TEACHER_NAME_TO_EMAIL[keyExact];

  if (!mappedEmail) {
    console.warn('⚠️ [MAPPING] Aucun email défini pour ce prof Excel:', keyExact);
    userCache.set(keyExact, null);
    return null;
  }

  const teacher = await User.findOne({
    role: 'teacher',
    email: mappedEmail.toLowerCase(),
  });

  if (!teacher) {
    console.warn('⚠️ [DB] User teacher introuvable pour email:', mappedEmail);
    userCache.set(keyExact, null);
    return null;
  }

  userCache.set(keyExact, teacher);
  return teacher;
}

/* ============================================================
   4️⃣ FONCTION: trouver une classe à partir du nom Excel
============================================================ */

async function findClasseByName(rawClassName) {
  if (!rawClassName) return null;
  const raw = String(rawClassName).trim();

  if (classeCache.has(raw)) return classeCache.get(raw);

  // 1) tentative correspondance exacte sur "nom"
  let classe = await Classe.findOne({ nom: raw });

  // 2) mapping Excel -> noms du seed si nécessaire
  if (!classe) {
    const upper = raw.toUpperCase();

    // ================= PRIMAIRE =================
    // 1 PRIM A / 1 PRIM B / "Classe : 1ère année Primaire" => même classe Mongo
    if (upper === '1 PRIM' || upper === '1 PRIM A' || upper === '1 PRIM B' ||
        upper.includes('1ÈRE ANNÉE PRIMAIRE') || upper.includes('1ERE ANNEE PRIMAIRE')) {
      classe = await Classe.findOne({ nom: '1ère année Primaire' });
    } else if (upper === '2 PRIM' || upper.includes('2EME PRIMAIRE') || upper.includes('2ÈME PRIMAIRE')) {
      classe = await Classe.findOne({ nom: '2ème année Primaire' });
    } else if (upper === '3 PRIM' || upper.includes('3EME PRIMAIRE') || upper.includes('3ÈME PRIMAIRE')) {
      classe = await Classe.findOne({ nom: '3ème année Primaire' });
    } else if (upper === '4 PRIM' || upper.includes('4EME PRIMAIRE') || upper.includes('4ÈME PRIMAIRE')) {
      classe = await Classe.findOne({ nom: '4ème année Primaire' });
    } else if (upper === '5 PRIM' || upper.includes('5EME PRIMAIRE') || upper.includes('5ÈME PRIMAIRE')) {
      classe = await Classe.findOne({ nom: '5ème année Primaire' });
    } else if (upper === '6 PRIM' || upper.includes('6EME PRIMAIRE') || upper.includes('6ÈME PRIMAIRE')) {
      classe = await Classe.findOne({ nom: '6ème année Primaire' });
    }

    // ================= 7ème & 8ème GENERAL (EB) =================
    if (!classe && (upper === '7ÉM EB' || upper === '7EM EB' || upper === '7EB')) {
      classe = await Classe.findOne({ nom: '7ème année' });
    }
    if (!classe && (upper === '8ÉM EB' || upper === '8EM EB' || upper === '8EB')) {
      classe = await Classe.findOne({ nom: '8ème année' });
    }

    // ================= "TOUS" =================
    if (
      !classe &&
      (upper === '1ÉTOUS' ||
        upper === '1ETOUS' ||
        upper === '1ÉR TOUS' ||
        upper === '1ER TOUS' ||
        upper === '1 TOUS' ||
        upper === '1TOUTES')
    ) {
      classe = await Classe.findOne({ nom: { $regex: /^1ère/i } });
    }

    if (
      !classe &&
      (upper === '2ÉM TOUS' || upper === '2EM TOUS' || upper === '2 TOUS' || upper === '2É TOUS')
    ) {
      classe = await Classe.findOne({ nom: { $regex: /^2ème/i } });
    }

    if (!classe && (upper === '3ÉM TOUS' || upper === '3EM TOUS' || upper === '3 TOUS')) {
      classe = await Classe.findOne({ nom: { $regex: /^3ème/i } });
    }

    if (
      !classe &&
      (upper === '4ÉM  TOUS' || upper === '4EM  TOUS' || upper === '4 TOUS' || upper === '4EM TOUS')
    ) {
      classe = await Classe.findOne({ nom: { $regex: /^4ème/i } });
    }

    // ================= COMMERCIALE & GESTION (CG) =================
    if (!classe && upper === '1CG') {
      classe = await Classe.findOne({ nom: '1ère Commerciale et gestion' });
    }
    if (!classe && upper === '2CG') {
      classe = await Classe.findOne({ nom: '2ème Commerciale et gestion' });
    }
    if (!classe && upper === '3CG') {
      classe = await Classe.findOne({ nom: '3ème Commerciale et gestion' });
    }
    if (!classe && upper === '4CG') {
      classe = await Classe.findOne({ nom: '4ème Commerciale et gestion' });
    }

    // ================= COUPE & COUTURE (TCC) =================
    if (!classe && (upper === '1TCC' || upper === '1 TCC')) {
      classe = await Classe.findOne({ nom: '1ère Coupe et couture' });
    }
    if (!classe && (upper === '2TCC' || upper === '2 TCC')) {
      classe = await Classe.findOne({ nom: '2ème Coupe et couture' });
    }
    if (!classe && (upper === '3TCC' || upper === '3 TCC')) {
      classe = await Classe.findOne({ nom: '3ème Coupe et couture' });
    }
    if (!classe && (upper === '4TCC' || upper === '4 TCC')) {
      classe = await Classe.findOne({ nom: '4ème Coupe et couture' });
    }

    // ================= ELECTRICITE (EL / ELEC / ELE) =================
    if (
      !classe &&
      (upper === '1 EL' ||
        upper === '1EL' ||
        upper === '1 ELEC' ||
        upper === '1ELEC' ||
        upper === '1 ELE' ||
        upper === '1ELE')
    ) {
      classe = await Classe.findOne({ nom: '1ère Électricité' });
    }
    if (
      !classe &&
      (upper === '2 EL' ||
        upper === '2EL' ||
        upper === '2 ELEC' ||
        upper === '2ELEC' ||
        upper === '2 ELE' ||
        upper === '2ELE')
    ) {
      classe = await Classe.findOne({ nom: '2ème Électricité' });
    }
    if (
      !classe &&
      (upper === '3 EL' ||
        upper === '3EL' ||
        upper === '3 ELEC' ||
        upper === '3ELEC' ||
        upper === '3 ELE' ||
        upper === '3ELE')
    ) {
      classe = await Classe.findOne({ nom: '3ème Électricité' });
    }
    if (
      !classe &&
      (upper === '4 EL' ||
        upper === '4EL' ||
        upper === '4 ELEC' ||
        upper === '4ELEC' ||
        upper === '4 ELE' ||
        upper === '4ELE')
    ) {
      classe = await Classe.findOne({ nom: '4ème Électricité' });
    }

    // ================= MECANIQUE GENERALE (MG) =================
    if (!classe && (upper === '1MG' || upper === '1 MG' || upper === '1ÈME MG' || upper === '1EME MG')) {
      classe = await Classe.findOne({ nom: '1ère Mécanique Générale' });
    }
    if (!classe && (upper === '2MG' || upper === '2 MG' || upper === '2ÈME MG' || upper === '2EME MG')) {
      classe = await Classe.findOne({ nom: '2ème Mécanique Générale' });
    }
    if (!classe && (upper === '3MG' || upper === '3 MG' || upper === '3ÈME MG' || upper === '3EME MG')) {
      classe = await Classe.findOne({ nom: '3ème Mécanique Générale' });
    }
    if (!classe && (upper === '4MG' || upper === '4 MG' || upper === '4ÈME MG' || upper === '4EME MG')) {
      classe = await Classe.findOne({ nom: '4ème Mécanique Générale' });
    }

    // ================= MECANIQUE AUTOMOBILE (MA) =================
    if (!classe && (upper === '1MA' || upper === '1 MA' || upper === '1ÈME MA' || upper === '1EME MA')) {
      classe = await Classe.findOne({ nom: '1ère Mécanique Automobile' });
    }
    if (!classe && (upper === '2MA' || upper === '2 MA' || upper === '2ÈME MA' || upper === '2EME MA')) {
      classe = await Classe.findOne({ nom: '2ème Mécanique Automobile' });
    }
    if (!classe && (upper === '3MA' || upper === '3 MA' || upper === '3ÈME MA' || upper === '3EME MA')) {
      classe = await Classe.findOne({ nom: '3ème Mécanique Automobile' });
    }
    if (!classe && (upper === '4MA' || upper === '4 MA' || upper === '4ÈME MA' || upper === '4EME MA')) {
      classe = await Classe.findOne({ nom: '4ème Mécanique Automobile' });
    }

    // ================= CAS MIXTES (BALTHAZAR & CO) =================
    if (!classe && (upper === '2È' || upper === '2E' || upper === '2E ')) {
      classe = await Classe.findOne({ nom: '2ème Mécanique Générale' });
    }

    if (!classe && (upper === '3ÈME' || upper === '3EME' || upper === '3ÈM' || upper === '3EM')) {
      classe = await Classe.findOne({ nom: '3ème Mécanique Générale' });
    }

    if (!classe && (upper === '1ÈME' || upper === '1EME' || upper === '1È' || upper === '1E')) {
      classe = await Classe.findOne({ nom: '1ère Mécanique Générale' });
    }

    // ================= HUMANITES LIT / SC / PED =================
    if (!classe && (upper === '3 LIT' || upper === '3LIT' || upper === '3 LT' || upper === '3LT')) {
      classe = await Classe.findOne({ nom: '3ème Littéraire' });
    }
    if (!classe && (upper === '4 LIT' || upper === '4LIT' || upper === '4 LT' || upper === '4LT')) {
      classe = await Classe.findOne({ nom: '4ème Littéraire' });
    }

    if (!classe && (upper === '1 SC' || upper === '1SC' || upper === '1ÉR  SC' || upper === '1ER  SC')) {
      classe = await Classe.findOne({ nom: '1ère Scientifiques' });
    }
    if (!classe && (upper === '2 SC' || upper === '2SC' || upper === '2ÉM SC' || upper === '2EM SC')) {
      classe = await Classe.findOne({ nom: '2ème Scientifiques' });
    }
    if (!classe && (upper === '3 SC' || upper === '3SC' || upper === '3ÉM SC' || upper === '3EM SC' || upper === '3 SC ')) {
      classe = await Classe.findOne({ nom: '3ème Scientifiques' });
    }
    if (!classe && (upper === '4 SC' || upper === '4SC' || upper === '4ÉM  SC' || upper === '4EM  SC')) {
      classe = await Classe.findOne({ nom: '4ème Scientifiques' });
    }

    if (!classe && (upper === '1 HP' || upper === '1HP')) {
      classe = await Classe.findOne({ nom: '1ère Pédagogie' });
    }
    if (!classe && (upper === '2 HP' || upper === '2HP' || upper === '2ÉM  HP' || upper === '2EM  HP')) {
      classe = await Classe.findOne({ nom: '2ème Pédagogie' });
    }
    if (!classe && (upper === '3 HP' || upper === '3HP' || upper === '3ÉM  HP' || upper === '3EM  HP')) {
      classe = await Classe.findOne({ nom: '3ème Pédagogie' });
    }
    if (!classe && (upper === '4 HP' || upper === '4HP' || upper === '4ÉM  HP' || upper === '4EM  HP')) {
      classe = await Classe.findOne({ nom: '4ème Pédagogie' });
    }
  }

  if (!classe) {
    console.warn('⚠️ [MAPPING] Classe non trouvée pour:', raw);
    classeCache.set(raw, null);
    return null;
  }

  classeCache.set(raw, classe);
  return classe;
}

/* ============================================================
   5️⃣ FONCTION: déduire optionCode / optionLabel
============================================================ */

function inferOptionFromClassName(className) {
  const n = (className || '').toUpperCase();

  // 7ème / 8ème = EB (Éducation de base)
  if (n.startsWith('7ÈME') || n.startsWith('7EME') || n.startsWith('8ÈME') || n.startsWith('8EME')) {
    return { optionCode: 'EB', optionLabel: 'Éducation de base (7ème-8ème)' };
  }

  // Primaire
  if (n.includes('PRIMAIRE')) {
    return { optionCode: 'PRIM', optionLabel: 'Primaire' };
  }

  // Maternelle
  if (n.includes('MATERNELLE')) {
    return { optionCode: 'MAT', optionLabel: 'Maternelle' };
  }

  // Commerciale et gestion
  if (n.includes('COMMERCIALE') || n.includes('GESTION')) {
    return { optionCode: 'CG', optionLabel: 'Commerciale & Gestion' };
  }

  // Scientifiques
  if (n.includes('SCIENTIFIQUE') || n.includes('SCIENTIFIQUES') || n.includes('SCIENCES')) {
    return { optionCode: 'SC', optionLabel: 'Scientifique' };
  }

  // Pédagogie
  if (n.includes('PÉDAGOGIE') || n.includes('PEDAGOGIE') || n.includes('HUMANITÉ PÉDAGOGIQUE')) {
    return { optionCode: 'HP', optionLabel: 'Humanités pédagogiques' };
  }

  // Coupe & couture
  if (n.includes('COUPE') || n.includes('COUTURE')) {
    return { optionCode: 'TCC', optionLabel: 'Coupe & Couture' };
  }

  // Électricité
  if (n.includes('ÉLECTRICITÉ') || n.includes('ELECTRICITE')) {
    return { optionCode: 'EL', optionLabel: 'Électricité' };
  }

  // Mécanique générale / automobile
  if (n.includes('MÉCANIQUE GÉNÉRALE') || n.includes('MECANIQUE GENERALE')) {
    return { optionCode: 'MG', optionLabel: 'Mécanique Générale' };
  }
  if (n.includes('MÉCANIQUE AUTOMOBILE') || n.includes('MECANIQUE AUTOMOBILE')) {
    return { optionCode: 'MA', optionLabel: 'Mécanique Automobile' };
  }

  // Littéraire
  if (n.includes('LITTÉRAIRE') || n.includes('LITTERAIRE')) {
    return { optionCode: 'LIT', optionLabel: 'Littéraire' };
  }

  // Par défaut
  return { optionCode: 'GEN', optionLabel: 'Général' };
}


/* ============================================================
   6️⃣ EXPORTS
============================================================ */

module.exports = {
  findTeacherUserByName,
  findClasseByName,
  inferOptionFromClassName,
};
