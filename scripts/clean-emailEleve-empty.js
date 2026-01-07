// scripts/clean-emailEleve-empty.js
require('dotenv').config();
const mongoose = require('mongoose');
const Eleve = require('../models/Eleve');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/collegelemerite';

(async () => {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);

    console.log('🧹 Nettoyage des emailEleve vides ("")...');
    const result = await Eleve.updateMany(
      { emailEleve: "" },
      { $unset: { emailEleve: "" } }
    );

    console.log(`✅ Documents modifiés: ${result.modifiedCount}`);

    console.log('🔎 Vérification rapide des doublons restants...');
    const stillEmpty = await Eleve.countDocuments({ emailEleve: "" });
    console.log(`📊 emailEleve == "" restant: ${stillEmpty}`);

    await mongoose.disconnect();
    console.log('🔌 Déconnexion MongoDB. Terminé.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur nettoyage emailEleve:', err);
    process.exit(1);
  }
})();
