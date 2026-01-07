// scripts/seed-classes-technique.js
// 🌱 SEED ÉLÈVES TECHNIQUE — 2ème & 4ème


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


// 🔗 Mapping "clé courte" -> noms de classes Mongo
const TECHNIQUE_CLASS_MAP = {
  // 2ème Technique
  '2_ELEC': '2ème Electricité',           // ou exactement comme dans Classe.nom
  '2_MG': '2ème Mécanique Générale',
  '2_MA': '2ème Mécanique Automobile',

  // 4ème Technique
  '4_ELEC': '4ème ELECTRICITE',           // respecte majuscules/accents si c’est comme ça en base
  '4_MG': '4ème Mécanique Générale',
  '4_MA': '4ème Mécanique Automobile',
};



// 🧒 Listes d'élèves 2ème & 4ème Technique
// 📊 Source: TECHNIQUE.xlsx
const ELEVE_TECHNIQUE = {
  // ---------- 2ème Technique ----------
  // 2ème Électricité
  '2_ELEC': [
    'Mwelwa longwa',
    'MALAMA NGOSA',
    'KWETE MABUDI',
    'KALABO SONGO',
    'MPONDE DONGO',
  ],

  // 2ème Mécanique Générale
  '2_MG': [
    'TSHUYA KABEMBA',
    'MWANSA CHULU',
    'MALOBA KAZADI',
    'MUTOMBO PUWA',
    'TSHILÉSHE BEMBA',
  ],

  // 2ème Mécanique Automobile
  '2_MA': [
    'NGOYI ILUNGA',
    'MUTOMBO TSHIBANGU',
    'SUMAYILI KAZADI',
    'KITWE WA KITWE',
  ],

  // ---------- 4ème Technique ----------
  // 4ème Électricité
  '4_ELEC': [
    'MALONGO MALEKA',
    'LWAMBA FUMBI',
    'TWITE TSHALA',
    'NGONGO WA NGONGO',
    'PUETE TENKE',
  ],

  // 4ème Mécanique Générale
  '4_MG': [
    'LENGE WA LENGE',
    'BIPENDU WA BIPENDU',
  ],

  // 4ème Mécanique Automobile
  '4_MA': [
    'TUMUKA BAJILA',
    'TONKETE BENZO',
    'MALUHO LOBA',
    'LONGA KABWILA',
  ],
};


// 🔤 Découper "NOM POSTNOM PRENOM"
function parseNomComplet(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { nom: parts[0], prenom: parts[0] };
  if (parts.length === 2) return { nom: parts[0], prenom: parts[1] };
  return { nom: parts[0], prenom: parts[parts.length - 1] };
}


async function seedElvesTechnique() {
  try {
    console.log('🌱 Seed élèves Technique (2ème & 4ème) — démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');


    let totalCrees = 0;
    let totalIgnores = 0;


    for (const key of Object.keys(ELEVE_TECHNIQUE)) {
      const classeNom = TECHNIQUE_CLASS_MAP[key];
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


      const noms = ELEVE_TECHNIQUE[key];


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
    console.log('✅ Seed élèves Technique (2ème & 4ème) terminé !');
    console.log(`👦👧 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');


    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-technique :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}


seedElvesTechnique();
