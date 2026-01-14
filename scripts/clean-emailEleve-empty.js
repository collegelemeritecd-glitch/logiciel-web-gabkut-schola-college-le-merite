// scripts/release-emailEleve-all.js

require('dotenv').config();
const mongoose = require('mongoose');
const Eleve = require('../models/Eleve');

const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/collegelemerite';

(async () => {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connecté:', MONGO_URI);

    console.log('🧹 Libération de TOUS les emailEleve (mise à null)...');
    const result = await Eleve.updateMany(
      { emailEleve: { $exists: true } },      // tous ceux qui ont le champ
      { $set: { emailEleve: null } }          // on garde le champ mais vide
    );

    console.log(`✅ Documents modifiés (emailEleve mis à null): ${result.modifiedCount}`);

    console.log('🔎 Vérification rapide:');
    const avecEmailNonVide = await Eleve.countDocuments({
      emailEleve: { $ne: null },
    });
    console.log(`📊 emailEleve non null restants: ${avecEmailNonVide}`);

    await mongoose.disconnect();
    console.log('🔌 Déconnexion MongoDB. Terminé.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur release emailEleve:', err);
    process.exit(1);
  }
})();
