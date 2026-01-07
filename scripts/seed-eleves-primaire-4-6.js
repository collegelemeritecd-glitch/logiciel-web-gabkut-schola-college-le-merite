// scripts/seed-eleves-primaire-4-6.js
// 📘 SEED ÉLÈVES PRIMAIRE (4ème, 5ème, 6ème) - Collège Le Mérite

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

// 🔗 Adapter EXACTEMENT aux noms de ta collection Classe
const PRIMAIRE_CLASS_MAP = {
  '4EME_PRIMAIRE': '4ème année Primaire',
  '5EME_PRIMAIRE': '5ème année Primaire',
  '6EME_PRIMAIRE': '6ème année Primaire',
};

// 🧒 Listes d’élèves 4ème–6ème Primaire
const ELEVE_PRIMAIRE_4_6 = {
  '4EME_PRIMAIRE': [
    'BADIBANGA BOWA',
    'BADIBANGA MBOWA',
    'BANZA NSENGA',
    'BIMPA KABUYA',
    'BWANGA MUKALAY',
    'DIANGENDA TSHILUMBA',
    'HABACUC MULUNDA',
    'ILUNGA NGALAMULUME',
    'ITUNGDA YAND',
    'KABAMBA KALABELA',
    'KABWIZA MUFIND',
    'KAHUDY ONAKOY',
    'KAJA MBALA',
    'KALENGA ILUNGA',
    'KAMBUYA MPUZA',
    'KAMWINA TSHIBANGU',
    'KANAJ LUBAL',
    'KAPENDA TUMBO',
    'KAPIAMBA MULUMBA',
    'KASONGO LUBOYA',
    'KAT KANYINDA',
    'KAVIRA KIBWE',
    'KIBANGA KABONGO',
    'KIBILA NKULU',
    'LIKOMBA MPOYI',
    'MAWANJI TSHIBANGU',
    'MBALA KABUYA',
    'MBEMBA KIFUKA',
    'MBIKAY MBIKAYI',
    'MBIYA NGANDU',
    'MBOMBO LUBOYA',
    'MBUYI ISAKO',
    'MBUYI KABONGO',
    'MBUYI MUKADI',
    'MOSE YABWA',
    'MUBUYI MUJANAY',
    'MUDJAYI LUBOYA',
    'MUFUTA LUKINO',
    'MUJINGA TKATSHUNG',
    'MUKALAY MUKALAY',
    'MUKUNA MUFUTA',
    'MULAMBA KAYOMBO',
    'MULANDWE MWENZA',
    'MULUNDA KASONGO',
    'MUNUNGA MWANGE',
    'MWABILU MWANZA',
    'MWAMBA WA MUKADI',
    'MWANGE MPUNTU',
    'MWANGE MUNUNGA',
    'MWANZA MUNGA',
    'MWANZA SALE',
    'MWIKA NGONGO',
    'NDJIBA TSHIVWADI',
    'NSENDWE YA SENDWE',
    'NTUMBA NGALULA',
    'OSENGE MASUDI',
    'SELEMANI MULUNDA',
    'TSHIBANGU SAMBAY',
    'TSHIBUNDA NGOY',
    'TSHIKUMBI KAPONDA',
    'TSHIPANGA KAPONDA',
    'TSHIPATA KABAMBI',
    'TSHITENGA MPOY',
    'TSHIYIJ LUKAMBO',
    'TUNDA YAND',
    'ULINGA MWENGA',
    'UZA UZA',
  ],
  '5EME_PRIMAIRE': [
    'BIUMA MUKABA',
    'BUREBU KASANGA',
    'BUSHABU NGOLO',
    'CHENGE MUGO',
    'ILUNGA KABIDA',
    'ILUNGA MWIKA',
    'KABAMBA KAZADI',
    'KABANGA MUYUMBA',
    'KABATU SWUILA KALONGO',
    'KAKOKO NGONGO',
    'KAMWANYA KAMWANYA',
    'KANKOLOGO MPOYI',
    'KANYINDA MUBENGA',
    'KASEYA KAKWENDA',
    'KAYITOND KIBWE',
    'KIKOKO ZAZI',
    'KOSONGO MUKADI',
    'LUBA LWANZAZI',
    'LUCIANA LUCIANA',
    'LUKOJI KABENGELE',
    'MALOBA MAMBWE',
    'MAPITA NGUNGA',
    'MAYENGA KASONGO',
    'MBALAYI BALOWAYI',
    'MBAYA KAMBO',
    'MBAYO KASONGO',
    'MBOMBO KAMBALE',
    'MONGA MALOBA',
    'MUKWAYA WETU',
    'MULAJI MULAJI',
    'MWADI KABAMBI',
    'MWADI NYUNGA',
    'MWAMBA KASONGO',
    'MWANDA KAZADI',
    'MWEZALI MUSAFIRI',
    'MWIKA ILUNGA',
    'NGALULA KABEMBA',
    'NGOMBA BUKASA',
    'NGONGO SAMBI',
    'NGOY SAPU',
    'NGOYA KANIKI',
    'NGOYA KANYIKI',
    'NKONGOLO MUKASU',
    'NTABWE ILUNGA',
    'NTUMBA KALENGALE',
    'NTUMBA MBUYI',
    'ODIA NGOIE',
    'OSANGO MAUWA',
    'SALIMA MAYANI',
    'TSHIBANGU DIKUKU',
    'VUMILIA MWENE',
    'WASENA KASENDO',
    'ZUBEDA WEMBI',
  ],
  '6EME_PRIMAIRE': [
    'BAKABI TSHILUMBA',
    'BATUNANGA MPUNTU',
    'BEMBA KIFUKA',
    'KABELU KAMBALA',
    'KABWIKA MBAYA',
    'KALADI KABAMBA',
    'KANAM KABWIT',
    'KANGUDIA MIONGO',
    'KANYINDA MBOMBO',
    'KAPENA WA MPUNTU',
    'KAPINGA LWAMBA',
    'KAPINGA NGALAMULUME',
    'KASENGA MPOYI',
    'KASONGO MULONGO',
    'KASONGO TABALA',
    'KAYEMBE MUKENDI',
    'KIBWE ILUNGA',
    'MAKONGO ROBISON',
    'MANYONGA KANGUDIA',
    'MBALA NKOSO',
    'MBALAY TSHIVWADY',
    'MBIYE MPUNTU',
    'MBUMBA BUKASA',
    'MITEO SAIDI',
    'MPOYI MPOYI',
    'MPOYI TSHIMAKINDA',
    'MPULUMBA KALENGA',
    'MUKENDI MUKENDI',
    'MULAMBA MULAMBA',
    'MUMETA KYANKONDO',
    'MUSEKA MUKASA',
    'MUSUNGAYI MBIKAY',
    'MUTELA MBOWA',
    'MWAPE MUMBA',
    'NDAYA KABAMBA',
    'NDAYA KABAMBA',
    'NDAYA KAUNDA',
    'NDAYA MUKENDINGALULA WASONGA',
    'NGALULA WA SONGA',
    'NGOY KATOLO',
    'NGOY MPIANA',
    'NKULA MAFUTA',
    'NKULU BARAKA',
    'NTUMBA BALOAYI',
    'NTUMBA MTUMBO',
    'NYEBA BULUKAY',
    'ODIA MUKUNA',
    'SAMUTERA KYANA',
    'SUMBU MUKENGE',
    'TSHIDIBI LUBOYA',
  ],
};

// 🔤 Découpe "NOM POSTNOM PRENOM"
function parseNomComplet(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { nom: parts[0], prenom: parts[0] };
  if (parts.length === 2) return { nom: parts[0], prenom: parts[1] };
  return { nom: parts[0], prenom: parts[parts.length - 1] };
}

async function seedElevesPrimaire4a6() {
  try {
    console.log('🌱 Seed élèves Primaire (4–6) - démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    let totalCrees = 0;
    let totalIgnores = 0;

    for (const key of Object.keys(ELEVE_PRIMAIRE_4_6)) {
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

      const noms = ELEVE_PRIMAIRE_4_6[key];

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
    console.log('✅ Seed élèves Primaire (4–6) terminé !');
    console.log(`👦👧 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-primaire-4-6 :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedElevesPrimaire4a6();
