// scripts/fix-postnom-eleve.js
require('dotenv').config();
const mongoose = require('mongoose');
const Eleve = require('../models/Eleve');

const MONGO_URI = process.env.MONGODB_URI; // 👈 utilise MONGODB_URI

const [,, eleveId, nouveauPostnom] = process.argv;

if (!eleveId || !nouveauPostnom) {
  console.error('❌ Usage: node scripts/fix-postnom-eleve.js <eleveId> <postnom>');
  process.exit(1);
}

(async () => {
  try {
    console.log('🔌 Connexion MongoDB...');
    await mongoose.connect(MONGO_URI);

    console.log('🔍 Recherche élève:', eleveId);
    const eleve = await Eleve.findById(eleveId);
    if (!eleve) {
      console.error('❌ Élève non trouvé');
      process.exit(1);
    }

    console.log('Avant:', {
      nom: eleve.nom,
      postnom: eleve.postnom,
      prenom: eleve.prenom,
    });

    eleve.postnom = nouveauPostnom;
    await eleve.save();

    console.log('✅ postnom mis à jour:');
    console.log({
      nom: eleve.nom,
      postnom: eleve.postnom,
      prenom: eleve.prenom,
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur fix-postnom-eleve:', err);
    process.exit(1);
  }
})();
