// scripts/rebuild-emailEleve-index.js
require('dotenv').config();
const mongoose = require('mongoose');
const Eleve = require('../models/Eleve');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/collegelemerite';

(async () => {
  try {
    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(MONGO_URI);

    console.log('📊 Index existants sur eleves:');
    const indexes = await Eleve.collection.indexes();
    console.log(indexes);

    console.log('🧨 Suppression de l’index emailEleve_1 (si existe)...');
    try {
      await Eleve.collection.dropIndex('emailEleve_1');
      console.log('✅ Index emailEleve_1 supprimé.');
    } catch (err) {
      console.log('ℹ️ Impossible de supprimer emailEleve_1 (peut-être inexistant):', err.message);
    }

    console.log('🏗️ Création index unique + sparse sur emailEleve...');
    await Eleve.collection.createIndex(
      { emailEleve: 1 },
      { unique: true, sparse: true }
    );

    console.log('✅ Nouvel index emailEleve_1 créé.');

    await mongoose.disconnect();
    console.log('🔌 Déconnexion MongoDB. Terminé.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur rebuild index emailEleve:', err);
    process.exit(1);
  }
})();
