// scripts/seed-eleves-secondaire-7-8.js
// 📘 SEED ÉLÈVES SECONDAIRE (7ème & 8ème) - Collège Le Mérite

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

// 🔗 Mapping interne -> nom de classe Mongo
const SECONDAIRE_CLASS_MAP = {
  '7EME': '7ème année',
  '8EME': '8ème année',
};

// 🧒 Listes d’élèves Secondaire
const ELEVE_SECONDAIRE_7_8 = {
  '7EME': [
    'AMISI DIAMBAKA',
    'BABINGI SENGI ELIE',
    'BEMBA NYOTA',
    'ISAKO NDOMBE',
    'KABEYA LUMBALA MANASSE',
    'KABEYA LUMBALA MANASSE',
    'KALAMBO MUKEMBE',
    'KALENGA LUSA MIRADIE',
    'KALENGA NYEMBO SHUKRANI',
    'KALONJI KAMBALA',
    'KAMBANGA MPOYI DIANNA',
    'KANGULUNGU KALABELA',
    'KANZUNDU MARIE ANGE',
    'KASANGA MAWITO DIVINE',
    'KASEYA LUKAMBO DAVINA',
    'KASONGO BUKASA BRAYANE',
    'KAYEMBE TSHIBANDA EXAUCE',
    'KAYO KEBEMBA',
    'KONGOLO ILUNGA',
    'KWETEMBEKI NGOLO ISRAEL',
    'MALOBA KASONGO DANIELLA',
    'MBALA LONGO',
    'MBUYA KASONGO',
    'MPIANA MPOYI BEN',
    'MUJINGA MUKENDI',
    'MUJINGA SAPU',
    'MUJINGA TSHILEMBI ARMELLE',
    'MULAJA NTUMBA NOE',
    'MULOGOY MBUTA',
    'MULULU AERTS CHRISTIANA',
    'MUSUMBA KAZADI',
    'MWAD MUFIND',
    'MWANZA KAZADI',
    'MWEHU MULUNDA DIEUDO',
    'NGALULA MULOWAYI',
    'NGOY MASENGO',
    'NGOYA MASENGO',
    'NSUMBU MUKASU',
    'OSENGE MANGA',
    'SAFI ILUNGA BELIEVE',
    'SUMBU MUKASU',
    'TSHIBUABUA LUBOYA JOSUE',
  ],
  '8EME': [
    'AMSINI BIN SALEH',
    'BATWAKAPA MUKEBA',
    'BETU KANDE AUGUSTINE',
    'BIN TEKESHA',
    'FEZA NONGA PASCALINE',
    'ILUNGA BILONDA',
    'ILUNGA KISHIMBA',
    'KABEDI LOBO',
    'KABEYA KAHUDY JEANCY',
    'KABEYA TSHIVUADI LIONEL',
    'KABULO MWANSA',
    'KAKONDE BUKASA',
    'KALALA MADJUNDA',
    'KALANGA KABONGO',
    'KALONDA MAYANI',
    'KALONDA MAYANI RIZIKI',
    'KAMWANYA TSHIVUADI',
    'KANUMBI KANUMBI',
    'KASONGO MUSAMPA',
    'KATUMBI KASONGO',
    'KAZADI MAKIMBA',
    'KISOLOKELE TSHILUMBA',
    'KYABU KANDOLO',
    'LUBANDA MBAYA',
    'LUKAKI KYAKONDO',
    'LUMPUNGU NGONGO',
    'MBAYA KATEMBU',
    'MBOMBO BUKASA',
    'MBOSHO MANYONGA',
    'MBUYI MUSAU',
    'MUJINGA KAZADI EL DJONAI',
    'MUKAJIMUENYI KAYOMBO',
    'MULENDI KABWIZA',
    'NDAYA BEYA GRACIELLA',
    'NGOMB NASONG',
    'NKULU KILUMBA KEN',
    'NTUMBA MPIANA',
    'NUMBI MWENZE',
    'NZANZI MWANA BUTE',
    'OSEANE REMODO',
    'SENGI BIZAMA',
    'SHIKEMA MWAPE',
    'TSHILANDA KABONGO',
    'TSHIMANGA TSHIBAMBA',
    'TWITE MAYANI AMANI',
    'WASAMBA KALEJ ISRAEL',
  ],
};

// 🔤 Découper "NOM POSTNOM PRENOM"
function parseNomComplet(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { nom: parts[0], prenom: parts[0] };
  if (parts.length === 2) return { nom: parts[0], prenom: parts[1] };
  return { nom: parts[0], prenom: parts[parts.length - 1] };
}

async function seedElevesSecondaire7et8() {
  try {
    console.log('🌱 Seed élèves Secondaire (7ème & 8ème) - démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    let totalCrees = 0;
    let totalIgnores = 0;

    for (const key of Object.keys(ELEVE_SECONDAIRE_7_8)) {
      const classeNom = SECONDAIRE_CLASS_MAP[key];
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

      const noms = ELEVE_SECONDAIRE_7_8[key];

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
    console.log('✅ Seed élèves Secondaire (7ème & 8ème) terminé !');
    console.log(`👦👧 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-secondaire-7-8 :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedElevesSecondaire7et8();
