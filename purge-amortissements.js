// purge-amortissements.js
const mongoose = require('mongoose');
const EcritureComptable = require('./models/comptable/EcritureComptable');

const MONGO_URL = 'mongodb+srv://collegelemeritecd_db_user:iQFQEcn4JpB8UpFz@college-le-merite.fp5hzor.mongodb.net/collegelemerite?retryWrites=true&w=majority'; // adapte si besoin

async function run() {
  try {
    console.log('Connexion MongoDB...');
    await mongoose.connect(MONGO_URL);

    const result = await EcritureComptable.deleteMany({
      typeOperation: 'Amortissement'
    });

    console.log(`Supprimé ${result.deletedCount} écriture(s) d'amortissement.`);
  } catch (err) {
    console.error('Erreur purge amortissements :', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
