// scripts/seedElevesMaternelle.js
// 📘 SEED ÉLÈVES MATERNELLE - Collège Le Mérite
// Backend Node.js - Gabkut Agency LMK +243822783500
// scripts/seed-eleves-maternelle.js 

require('dotenv').config();
const mongoose = require('mongoose');

const Classe = require('../models/Classe');
const Eleve = require('../models/Eleve');
const { genererMatriculePro } = require('../utils/matriculePro');

// 🔑 URI Mongo cohérente avec resetElevesSeed.js
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.DB_URI ||
  process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI manquant. Vérifie ton .env (MONGODB_URI).');
  process.exit(1);
}

const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

// 🔗 Mapping section Excel -> nom de classe Mongo
const MATERNELLE_CLASS_MAP = {
  '1ERE_MATERNELLE': '1ère année Maternelle',
  '2EME_MATERNELLE': '2ème année Maternelle',
  '3EME_MATERNELLE': '3ème année Maternelle',
};

// 🧒 Listes d’élèves extraites d’Excel
const ELEVE_MATERNELLE = {
  '1ERE_MATERNELLE': [
    'BANZA LWABEYA',
    'KABILA MULUNGA EVAN',
    'KABOKO MASENGO DIEU MERCI',
    'KALUNDU WAYA',
    'KATHANGA SUTIVE SAMUEL',
    'LOBOWA LOBO ELHA',
    'LUBAMBA MBALA KAIRA',
    'LWANGA KAMPONDA JOANE',
    'MWADI KABAMBA',
    'MWIKA KATABWE EUTYCHE',
    'NKULU KONI',
    'TSHIMANGA KAYEMBE JOHY',
    'TWITE KASONGO LAURISS',
  ],
  '2EME_MATERNELLE': [
    'AKIETE MULONDA',
    'AMUNDA MUSA',
    'BILONDA LORIS',
    'CHRISLIN',
    'DEO KALENGA LENGA',
    'DJUNGA KASONGO',
    'FWAMBA MALOBA',
    'ILUNGA KASONGO',
    'JUNGA KASONGO',
    'KABEDI KALONJI',
    'KABUYA MBUYI',
    'KABWIKA UTAJIRI',
    'KAMBAMBA LUKUSA',
    'KAMBUYI UTAJIRI',
    'KAPENDA MUKALU',
    'KAPINGA PINDA',
    'KATUTWA KYANIC',
    'LITALEMA GUELEME',
    'LUFUNGULA KAHUDI',
    'LWABO WABA',
    'MAKOSO NSENGA',
    'MANDEFU KESSIE',
    'MAYUMBA BIEKA',
    'MBALA MBUYI',
    'MBOKASHANGA ILUNGA',
    'MBOMBO KADIMA',
    'MBUYI KABUYA',
    'MENDI MUDIPANU',
    'MFUWA NGOLO',
    'MIKENI MIKOKA',
    'MISABIYABU TSHIMBAMBA',
    'MUKENDI KAMBALA',
    'MUKENDI KAMBALA',
    'MUNUNGA KASAI',
    'MUSHIYA MBALA',
    'MWIKA MUKENDI',
    'NGALULA BADIBANGA',
    'NGALULA MBELEMBELE',
    'NTUMBA BENGESHA',
    'NTUMBA TOKANDJO',
    'POLYDOR KASAI',
    'TSHIKA MWEPU',
    'TSHIKUNA NGANDU',
    'TSHITUNDU MPOYI',
    'TSHIWENGO MUTANDA',
    'WABIKALA WA MWIDIA',
  ],
  '3EME_MATERNELLE': [
    'BARAKA MUSENDWE',
    'BELESI BILALA',
    'BELESI BIZALA',
    'DIMANGI ILUNGA',
    'ILUNGA DINANGA',
    'KABAMBA KABAMBA',
    'KABAMBA KABAMBI',
    'KABAMBA MULUKA',
    'KALOLO KALALA',
    'KALUNDU MUSOGA',
    'KAMWANYA MULUMBA',
    'KANKESA NGONGO PRISCILIA',
    'KAPINGA MPOYI',
    'KAPONDA BILONDA',
    'KAZUNDU MPOYI',
    'MAKONGO ROBERTA FLORTA FLORE',
    'MBOMBO AZIZA GUSTIVIE',
    'MBOMBO LUBOYA JOYCE',
    'MBOMBO LUKONYA BELVIE',
    'MBUYI MUKENDI OLGA',
    'MITONDU KAYOMBO',
    'MONGA ZAZI BENAJA',
    'MPOYI MPOYI',
    'MUJINGA MPIANA LOUANGE',
    'MUKENDI WALELU',
    'MUKUNA NGALAMULUME',
    'MULEKA KANGUDIA PRODIGE',
    'MULUMBA ILUNGA',
    'MULUNDA MUKENGE',
    'MULWA SOUTIYE',
    'MUTANGA MBOWA VANEL',
    'MUTOKA NDIBA DORCHEL',
    'MWAKU KABATA GRACIELA',
    'MWEMA MUKALA ANAEL',
    'NDAYA MBIKAYI PRUNEL',
    'NGALAMULUME',
    'NJIMBA KYANKONDO AMMIEL',
    'NKULU SARIONA',
    'NKULU SORIANO',
    'NTUMBA LUVINO',
    'NYEMBO USHINDI TRIOMPHE',
    'OSANGO SAMUEL',
    'SHAMBA DIKUYI JOSEPH',
    'TSHIANYI KAPIAMBA',
    'TSHITSHIBI BAJIKIJAY',
  ],
};

// 🔤 Découper "NOM POST-NOM PRENOM" en nom / prenom (postnom ignoré pour l’instant)
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

async function seedElevesMaternelle() {
  try {
    console.log('🌱 Seed élèves Maternelle - démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    let totalCrees = 0;
    let totalIgnores = 0;

    for (const key of Object.keys(ELEVE_MATERNELLE)) {
      const classeNom = MATERNELLE_CLASS_MAP[key];
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

      const noms = ELEVE_MATERNELLE[key];

      for (const nomComplet of noms) {
        if (!nomComplet || !nomComplet.trim()) continue;

        const { nom, prenom } = parseNomComplet(nomComplet);

        // éviter doublon : même nom + prenom + classe + année
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

        // Utiliser le générateur de matricule PRO centralisé
        const matricule = await genererMatriculePro();

        const eleveData = {
          matricule,
          nom,
          prenom,
          sexe: 'M', // valeur par défaut simplifiée
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
    console.log('✅ Seed élèves Maternelle terminé !');
    console.log(`👶 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-maternelle :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedElevesMaternelle();
