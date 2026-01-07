// scripts/seed-eleves-college-2eme.js
// 📘 SEED ÉLÈVES COLLÈGE (2èmes) - Collège Le Mérite

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

// 🔗 Mapping interne -> noms de classes MongoDB
const COLLEGE_2_CLASS_MAP = {
  '2_LITT': '2ème Humanité Littéraire',
  '2_PEDAGO': '2ème Humanité Pédagogique',
  '2_SC': '2ème Humanité Sciences',
  '2_COM': '2ème Commerciale et gestion',
  '2_COUPE': '2ème Coupe et couture',
  '2_ELEC': '2ème Électricité',
  '2_MEC_GEN': '2ème Mécanique Générale',
  '2_MEC_AUTO': '2ème Mécanique Automobile',
};

// 🧒 Listes d’élèves Collège 2ème
const ELEVE_COLLEGE_2EME = {
  // 2ème Littéraire
  '2_LITT': [
    'KAMBALA WA KAMBALA',
    'KAZADI KATUNGA',
    'MUKWAYA KAMENGA',
    'SHEDI AMINA',
    'MULONGOY KABWIZA',
    'ASSAKA NYEPAMBA',
  ],

  // 2ème Humanité Pédagogique
  '2_PEDAGO': [
    'KALONJI KAYOMBO',
    'KAYEMBE KAYEMBE',
    'MPAZU MIGUEL',
    'MULAJ KALWA',
    'MUDIAYI BUKASA',
    'SONGA KANYIKI',
  ],

  // 2ème Commerciale et gestion
  '2_COM': [
    'BAMONI MASENGO MIRADIE',
    'EBANDA MUFAYA',
    'LUANYI NGONGO',
    'MAYELE MAFUTA',
    'MULULU AERSTS MARIE',
    'MULONGOY SALUMU',
  ],

  // 2ème Coupe et couture
  '2_COUPE': [
    'SAMBA KENGE',
  ],

  // 2ème Humanité Sciences
  '2_SC': [
    'BAKAJIKA KALONGO',
    'KABWIZA TSHIAYILA',
    'KAYEMBE TSHIVUADI',
    'MBUYI BUADI',
    'NDANGU TSHIVUADI',
    'NDAYA TSHILEMBI',
    'TWITE NGOY',
    'MARGARIDA NYOMBO',
    'SANGA KANYIKI',
  ],

  // Aucune donnée fournie pour ces sections techniques pour l’instant
  '2_ELEC': [],
  '2_MEC_GEN': [],
  '2_MEC_AUTO': [],
};

// 🔤 Découper "NOM POSTNOM PRENOM"
function parseNomComplet(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { nom: parts[0], prenom: parts[0] };
  if (parts.length === 2) return { nom: parts[0], prenom: parts[1] };
  return { nom: parts[0], prenom: parts[parts.length - 1] };
}

async function seedElevesCollege2eme() {
  try {
    console.log('🌱 Seed élèves Collège (2èmes) - démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    let totalCrees = 0;
    let totalIgnores = 0;

    for (const key of Object.keys(ELEVE_COLLEGE_2EME)) {
      const classeNom = COLLEGE_2_CLASS_MAP[key];
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

      const noms = ELEVE_COLLEGE_2EME[key];

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
          sexe: 'M',
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
    console.log('✅ Seed élèves Collège (2èmes) terminé !');
    console.log(`👦👧 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-college-2eme :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedElevesCollege2eme();
