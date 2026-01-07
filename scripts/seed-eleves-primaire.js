// scripts/seed-eleves-primaire.js
// 📘 SEED ÉLÈVES PRIMAIRE - Collège Le Mérite
// Backend Node.js - Gabkut Agency LMK +243822783500

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

// 🔗 Mapping interne -> nom de classe Mongo (adapte selon ta collection Classe)
const PRIMAIRE_CLASS_MAP = {
  '1ERE_PRIMAIRE': '1ère année Primaire',
  '2EME_PRIMAIRE': '2ème année Primaire',
  '3EME_PRIMAIRE': '3ème année Primaire',
};

// 🧒 Listes d’élèves PRIMAIRE (NOM POSTNOM ou NOM POSTNOM PRENOM)
const ELEVE_PRIMAIRE = {
  '1ERE_PRIMAIRE': [
    'AMARU LUBA',
    'BANGUSHA MULONGOY',
    'BEYA KAPONDA',
    'BEYA WA BEYA',
    'BIOLA KAZUMBA',
    'BUKASA MATAMBA',
    'ILUNGA DIKUKU',
    'ILUNGA MUKALA',
    'ILUNGA MWANAFITA',
    'ILUNGA PUNGA',
    'INDWA KITENGE',
    'KABANGA MULAMBA',
    'KABELA KIENGE',
    'KABEYA KALONJI',
    'KABONGO MULUMBA',
    'KABWANGA TSHILUMBA',
    'KALENDA NTALAJA',
    'KAMA MALENGU',
    'KANDA KANDA',
    'KANGUZA MPUMA',
    'KANKU WEMBI',
    'KANKWENDA KANKWENDA',
    'KANYEBA MUKOKA',
    'KANYINDA TAUNYA',
    'KAPENA WA LUBOYA',
    'KAYANDJI MWANZA',
    'KITENGE KATENDE',
    'LITALEMA LIBOTE',
    'LUBIAMBA LONGOKA',
    'LUSAMBA ILUNGA',
    'MADIYA MPINDA',
    'MANDEFU JOEL',
    'MANGABU TSHIBANGU',
    'MBALA NZEBZ',
    'MBOKASHANGA NGOLO',
    'MBUYI KAZADI',
    'MILOLO UZA',
    'MITONGA KALABELA',
    'MOIKA KASOBA',
    'MUDIBU NGANDU',
    'MUNYIKA BUZANGU',
    'MUSAO LOBO',
    'MUTOMBO BUKASA',
    'MUTOMBO KAZADI',
    'NDALA MUTONKOLE',
    'NDAYI NSENGA',
    'NGENYI BUNGI',
    'NGOMBA MALOBA',
    'NGOMBA MPOYI',
    'NGOMBA MUKENGE',
    'NGOY MUSENDWE',
    'NGOY MUTONKOLE',
    'NKARA VOUZA',
    'NKULU NKONI',
    'NTAMBWE MUSWAMBA',
    'NTUMBA KALENDA',
    'NTUMBA KALENGALENGA',
    'NTUMBA MUDIPANU',
    'NYEMBA SUMPU',
    'ODIA LONJI',
    'PANDI MWEPU',
    'TSHIKA KABANGA',
    'UMBA NKULU',
    'WAPENA LUKEBA',
    'WENGA SHONGO',
  ],
  '2EME_PRIMAIRE': [
    'BAKANDE SUMU',
    'BATUBENGA TSHILUMBA',
    'BUANGA MWANA BEBE',
    'BUTUMBI MUKENDI',
    'CIBANGU ILUNGA',
    'DEMBO TOKANDJO',
    'FEZA AMISI',
    'ILUNGA KASENGELE',
    'KABENA SENGI',
    'KABEYA KABEYA',
    'KABEYA KAYOMBO',
    'KAKALA KALALA',
    'KALBALA WA KAMBALA',
    'KAMBUYA BAJIKILAYI',
    'KANDU KISALA',
    'KANGUDIA WA KANGUDIA',
    'KANKOLONGO ILUNGA',
    'KANKOLONGO MPOYI',
    'KATENDE TSHIABUEKANO',
    'KIBANG MULUMBA',
    'LETA MUTOMBO',
    'LUBABA NSENGA',
    'LUKOJI KALONJI',
    'MABILA MANYONGA',
    'MAKONGO JUBERTHE',
    'MASENGO MASENGO',
    'MATANDA KABAMBA',
    'MAUWA KASONGO',
    'MBAMBI UZA',
    'MBEMBA MANGALA',
    'MBOBMBO KAHUDY',
    'MBULA MBANTSHI',
    'MBUYU LEBA',
    'MFULABANTU MFULABANTU',
    'MOLIA MUJINGA',
    'MOLIA MUJINGA',
    'MPOYI MPOYI',
    'MUJINGA TSHIBAMBA',
    'MUTOMBO VAINQUEUR',
    'NDJIBA MBAYA',
    'NGANDU NGANDU',
    'NGOY KAYEMBE',
    'NKANKOLONGO MBAYA',
    'NKULA DIZOLELE',
    'NTAMBWA BILONDA',
    'NZEMBO MUKENDI',
    'ODIA MBOWA',
    'OLOKO KASOBA',
    'SABWA KALENGALENGA',
    'SAFI BONDO',
    'SAMUTERA LUTENDE',
    'SHALA MWERI',
    'TSHEBA KATENDE',
    'TSHIAMBA WASONGA',
    'TSHIANDA KAWAYA',
    'TSHIEBWE TSHIEBWE',
    'TSHIKUMBI TSHIBAMBA',
    'TSHIKUTA MULUMBA',
    'TSHILUMBA TSHIBAMBA',
    'WASAMBA TSHAMBA',
  ],
  '3EME_PRIMAIRE': [
    'BANDA KAPENA',
    'BONDO KABANGA',
    'EBONDO NGONGO',
    'ISAKO NDOMBE',
    'KABAMBI KANYINDA',
    'KABEYA BIZALA',
    'KABUNDA KABONGO',
    'KALONJI FISTON',
    'KALUNDU KALONGA',
    'KANON KAZADI',
    'KANUNGA KALABELA',
    'KANYINDA SHEKA',
    'KINZI NGOLO',
    'LONJI SENGI',
    'LUSINI AIWALA',
    'MALENGU MALENGU',
    'MALONGO MPIANA',
    'MALUSI LUKINO',
    'MAMPUMBA NGALAMULUME',
    'MBIYA MUJANAYI',
    'MBUYAMBA MUYUMBA',
    'MBUYI MUKENDI',
    'MBUYI MUSWAMBA',
    'MBWAYA KAZADI',
    'MBWEYA MPOYI',
    'MISENGABU TSHANYI',
    'MPUTU SALEH',
    'MPWEKELA KANYIKI',
    'MUKENDI MPUNTU',
    'MUKUNA MUKUNA',
    'MULULU AERTS',
    'MULUNDA AMANI',
    'MUSHIYA MUKEBA',
    'MWAD MUFIND',
    'MWAMBA KASAKA',
    'MWANZA KABATA',
    'MWANZA TSHILAY',
    'NDUMBI MBOWA',
    'NGALA WA SONGA',
    'NGALULA KALONGA',
    'NGOYA MPOYI',
    'NONGA MUFUTA',
    'NTUMBA MUKADJI',
    'NTUMBA MUYUMBA',
    'NTUMBA NGALULA',
    'NYAMABU KAMBALA',
    'NYEMBA NZEWU',
    'NYEMBO SANGWA',
    'ODIA KANYIKI',
    'PINDA PINDA',
    'SANGO KAYABU',
    'SANGO RAYABO',
    'TSHANDA NGALULA',
    'TSHIBANDA KAWAYA',
    'TSHIKOBO LUBA',
    'TSHILEMBI KABANGU',
    'TSHISAU BIZALA',
  ],
};

// 🔤 Découper "NOM POSTNOM PRENOM" en nom / prenom (postnom ignoré pour l’instant)
function parseNomComplet(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) {
    return { nom: parts[0], prenom: parts[0] };
  }
  if (parts.length === 2) {
    return { nom: parts[0], prenom: parts[1] };
  }
  return {
    nom: parts[0],
    prenom: parts[parts.length - 1],
  };
}

async function seedElevesPrimaire() {
  try {
    console.log('🌱 Seed élèves Primaire - démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    let totalCrees = 0;
    let totalIgnores = 0;

    for (const key of Object.keys(ELEVE_PRIMAIRE)) {
      const classeNom = PRIMAIRE_CLASS_MAP[key];
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

      const noms = ELEVE_PRIMAIRE[key];

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
    console.log('✅ Seed élèves Primaire terminé !');
    console.log(`👦👧 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-primaire :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedElevesPrimaire();
