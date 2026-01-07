// scripts/seed-eleves-college-3-4.js
// 🌱 SEED ÉLÈVES COLLÈGE — 3ème & 4ème

require('dotenv').config();
const mongoose = require('mongoose');

const Classe = require('../models/Classe');
const Eleve = require('../models/Eleve');
const { genererMatriculePro } = require('../utils/matriculePro');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.DB_URI ||
  process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI manquant. Vérifie ton .env (MONGODB_URI).');
  process.exit(1);
}

const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

// 🔗 Mapping “clé courte” -> noms de classes Mongo
const COLLEGE_3_4_CLASS_MAP = {
  // 3ème
  '3_SC': '3ème Scientifiques',
  '3_LIT': '3ème Littéraire',
  '3_PED': '3ème Pédagogie',
  '3_COM': '3ème Commerciale et gestion',
  '3_COUPE': '3ème Coupe et couture',
  '3_ELEC': '3ème Électricité',
  '3_MG': '3ème Mécanique Générale',
  '3_MA': '3ème Mécanique Automobile',

  // 4ème
  '4_SC': '4ème Scientifiques',
  '4_LIT': '4ème Littéraire',
  '4_PED': '4ème Pédagogie',
  '4_COM': '4ème Commerciale et gestion',
  '4_COUPE': '4ème Coupe et couture',
  '4_ELEC': '4ème Électricité',
  '4_MG': '4ème Mécanique Générale',
  '4_MA': '4ème Mécanique Automobile',
};

// 🧒 Listes d’élèves 3ème & 4ème Collège
const ELEVE_COLLEGE_3_4 = {
  // ---------- 3ème ----------
  // 3ème Scientifiques
  '3_SC': [
    'BIN NTUMBA',
    'MOMBELE TSHULU',
    'MUJANAYI MAMPINDA',
    'MUKUMINE NGONGO',
    'MUSUAMBA NYEMBWE',
    'TSHIBOLA NGALAMULUME',
    'YABWA MOSE',
    'MULULU AERTS ALPHONSINE',
  ],

  // 3ème Littéraire
  '3_LIT': [
    'FOLRIANO MORISANO',
    'MUBIA KABANDANI',
    'TAMINA SHEDI',
    'TSHELA MBAYA',
  ],

  // 3ème Pédagogie
  '3_PED': [
    // (aucun nom fourni pour l’instant)
  ],

  // 3ème Commerciale et gestion
  '3_COM': [
    'MASENGO MBALA',
    'ODIA KAZADI',
    'OMETO NTWAMBA',
    'TSHILEMBA NYEMBWE',
    'TSHIYOYI NGALAMULUME',
  ],

  // 3ème Coupe et couture
  '3_COUPE': [
    'MILOLO NTUMBA',
    'SUMPI KAHUDY',
  ],

  // 3ème Électricité
  '3_ELEC': [
    'TSHIMBALA NTUMBA',
  ],

  // 3ème Mécanique Générale
  '3_MG': [
    'TSHIKOMBO LUBOYA',
  ],

  // 3ème Mécanique Automobile
  '3_MA': [
    'MBIOLA KITETE',
  ],

  // ---------- 4ème ----------
  // 4ème Scientifiques
  '4_SC': [
    'MPANGA VENACY',
  ],

  // 4ème Littéraire
  '4_LIT': [
    'LUKADI TSHIMBELA',
    'LUSE MULAMBA',
    'MWAUKA KALALA',
  ],

  // 4ème Pédagogie
  '4_PED': [
    'KAIKEZ MULALI',
    'KAYAKEZ MUZAZ',
    'KILANDO KITENGE',
    'MBAYA BATWAMBA',
    'NDAYA KATOMPA',
    'NDAYA MBAYA',
    'NTUMBA MULUNDA',
    'NYOMBO KENGE',
  ],

  // 4ème Commerciale et gestion
  '4_COM': [
    'KWELEKA KAPENDA',
    'MUJINGA NYEMBWE',
  ],

  // 4ème Coupe et couture
  '4_COUPE': [
    'MBUYAMBA KABONGO MIRADIE',
  ],

  // 4ème Électricité
  '4_ELEC': [
    // aucun élève pour l’instant
  ],

  // 4ème Mécanique Générale
  '4_MG': [
    // aucun élève pour l’instant
  ],

  // 4ème Mécanique Automobile
  '4_MA': [
    // aucun élève pour l’instant
  ],
};

// 🔤 Découper "NOM POSTNOM PRENOM"
function parseNomComplet(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { nom: parts[0], prenom: parts[0] };
  if (parts.length === 2) return { nom: parts[0], prenom: parts[1] };
  return { nom: parts[0], prenom: parts[parts.length - 1] };
}

async function seedElevesCollege3Et4() {
  try {
    console.log('🌱 Seed élèves Collège (3ème & 4ème) — démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    let totalCrees = 0;
    let totalIgnores = 0;

    for (const key of Object.keys(ELEVE_COLLEGE_3_4)) {
      const classeNom = COLLEGE_3_4_CLASS_MAP[key];
      if (!classeNom) {
        console.warn(`⚠️ Pas de mapping de classe pour ${key}, ignoré`);
        continue;
      }

      const classe = await Classe.findOne({ nom: classeNom });
      if (!classe) {
        console.warn(`⚠️ Classe introuvable en base : ${classeNom}, élèves de ${key} ignorés`);
        continue;
      }

      console.log(`\n🏫 Classe trouvée : ${classe.nom} (${classe._id})`);

      const noms = ELEVE_COLLEGE_3_4[key];

      for (const nomComplet of noms) {
        if (!nomComplet || !nomComplet.trim()) continue;

        const { nom, prenom } = parseNomComplet(nomComplet);

        const existing = await Eleve.findOne({
          nom,
          prenom,
          classe: classe._id,
          anneeScolaire: ANNEE_SCOLAIRE,
        });

        if (existing) {
          console.log(`ℹ️ Élève déjà existant : ${nomComplet} (${classe.nom})`);
          totalIgnores++;
          continue;
        }

        const matricule = await genererMatriculePro();

        const eleveData = {
          matricule,
          nom,
          prenom,
          sexe: 'M', // à ajuster manuellement si besoin
          classe: classe._id,
          anneeScolaire: ANNEE_SCOLAIRE,
          montantDu: classe.montantFrais || 0,
          montantPaye: 0,
          moisPayes: '',
          statut: 'actif',
          dateInscription: new Date(),
        };

        await Eleve.create(eleveData);
        console.log(`✅ Élève créé : ${nomComplet} → ${classe.nom} (${matricule})`);
        totalCrees++;
      }
    }

    console.log('\n🎉 ========================================');
    console.log('✅ Seed élèves Collège (3ème & 4ème) terminé !');
    console.log(`👦👧 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-college-3-4 :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedElevesCollege3Et4();
