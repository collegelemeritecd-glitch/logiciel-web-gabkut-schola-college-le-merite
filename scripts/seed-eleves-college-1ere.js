// scripts/seed-eleves-college-1ere.js
// 📘 SEED ÉLÈVES COLLÈGE (1ères) - Collège Le Mérite

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
const COLLEGE_CLASS_MAP = {
  '1ERE_LITT': '1ère Littéraire',
  '1ERE_SC': '1ère Scientifiques',
  '1ERE_PEDAGO': '1ère Pédagogie',
  '1ERE_COM': '1ère Commerciale et gestion',
  '1ERE_COUPE': '1ère Coupe et couture',
  '1ERE_ELEC': '1ère Électricité',
  '1ERE_MEC_GEN': '1ère Mécanique Générale',
  '1ERE_MEC_AUTO': '1ère Mécanique Automobile',
};

// 🧒 Listes d’élèves Collège 1ère
const ELEVE_COLLEGE_1ERE = {
  '1ERE_LITT': [
    'MWELO KALONJI',
    'TSHIELA MPUMBU',
  ],
  '1ERE_SC': [
    'MWENEBATU MWENEBATU',
    'TSHOBA KANKWENDA',
    'ELIE MWANEBATU',
    'MULAJ TSHINYAM',
  ],
  '1ERE_ELEC': [
    'ILUNGA NGONGO',
    'KABONGO KANYINDA',
    'KILUFYA KISANGA',
    'KAZADI KADI',
    'KAN KABEMBA',
    'KAZADI KAZADI',
  ],
  '1ERE_COM': [
    'BAMANA MUKENSHAYI',
    'MBELU MATENDA',
    'MBUYI KANGUDIA',
    'MPANGA TSHIKALA',
    'TSHIANDA MUKASU',
  ],
  '1ERE_COUPE': [
    'KAPINGA KABAMBA',
    'KAZADI MADJUNDA',
    'MUKANDO SABINA',
    'MUSHIYA MPOYI',
    'KUMWIMBA MUSENDWE',
    'KABEDI KAZADI',
  ],
  '1ERE_MEC_AUTO': [
    'DIALUNGANA TSHILUMBA',
    'KASONGO MULONGO',
    'KAYEMBE MBALA',
    'LUMBAYI MUJANAYI',
    'TSHIANGOMBA LUBOYA',
    'KADIMA TSHIPANGILA',
  ],
  '1ERE_PEDAGO': [
    'KAZADI KALONGA',
    'KIBAMBE TSHULU',
  ],
  '1ERE_MEC_GEN': [
    'BIN SALA MULAMBA',
    'KADIMA TSHIMPANGILA',
    'MULEBA MWABA',
    'LUMBAY MUJANAY',
  ],
};

// 🔤 Découper "NOM POSTNOM PRENOM"
function parseNomComplet(raw) {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { nom: parts[0], prenom: parts[0] };
  if (parts.length === 2) return { nom: parts[0], prenom: parts[1] };
  return { nom: parts[0], prenom: parts[parts.length - 1] };
}

async function seedElevesCollege1ere() {
  try {
    console.log('🌱 Seed élèves Collège (1ères) - démarrage...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connecté');

    let totalCrees = 0;
    let totalIgnores = 0;

    for (const key of Object.keys(ELEVE_COLLEGE_1ERE)) {
      const classeNom = COLLEGE_CLASS_MAP[key];
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

      const noms = ELEVE_COLLEGE_1ERE[key];

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
    console.log('✅ Seed élèves Collège (1ères) terminé !');
    console.log(`👦👧 Nouveaux élèves créés : ${totalCrees}`);
    console.log(`ℹ️ Élèves déjà existants ignorés : ${totalIgnores}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log('🎉 ========================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-eleves-college-1ere :', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seedElevesCollege1ere();
