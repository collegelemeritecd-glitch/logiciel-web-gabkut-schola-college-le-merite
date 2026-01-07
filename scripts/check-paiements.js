const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Paiement = require('../models/Paiement');

async function checkPaiements() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connecté\n');

    const percepteurId = '694fbfea4df130a0c840f0be';

    console.log('📊 ÉTAT DES PAIEMENTS :\n');

    // Total paiements
    const total = await Paiement.countDocuments({});
    console.log(`📌 Total paiements : ${total}`);

    // Paiements avec percepteurId
    const avecPercepteur = await Paiement.countDocuments({
      percepteurId: { $exists: true, $ne: null }
    });
    console.log(`✅ Avec percepteurId : ${avecPercepteur}`);

    // Paiements SANS percepteurId
    const sansPercepteur = await Paiement.countDocuments({
      $or: [
        { percepteurId: { $exists: false } },
        { percepteurId: null }
      ]
    });
    console.log(`❌ Sans percepteurId : ${sansPercepteur}\n`);

    // Liste des 3 premiers paiements
    console.log('📄 EXEMPLES DE PAIEMENTS :\n');
    const exemples = await Paiement.find({})
      .limit(3)
      .select('_id eleveNom montant percepteurId percepteurNom anneeScolaire')
      .lean();

    exemples.forEach((p, i) => {
      console.log(`${i + 1}. ${p.eleveNom} - ${p.montant} USD`);
      console.log(`   percepteurId: ${p.percepteurId || 'UNDEFINED'}`);
      console.log(`   percepteurNom: ${p.percepteurNom || 'N/A'}`);
      console.log(`   anneeScolaire: ${p.anneeScolaire}\n`);
    });

    // Paiements du percepteur spécifique
    console.log(`🔍 Paiements du percepteur ${percepteurId} :\n`);
    
    const paiementsPercepteur = await Paiement.find({
      percepteurId: new mongoose.Types.ObjectId(percepteurId)
    }).countDocuments();

    console.log(`📊 Nombre trouvé : ${paiementsPercepteur}`);

    if (paiementsPercepteur > 0) {
      const exemple = await Paiement.findOne({
        percepteurId: new mongoose.Types.ObjectId(percepteurId)
      }).lean();
      
      console.log('✅ Exemple trouvé :', {
        eleve: exemple.eleveNom,
        montant: exemple.montant,
        percepteurId: exemple.percepteurId.toString()
      });
    } else {
      console.log('❌ Aucun paiement trouvé pour ce percepteur');
    }

    await mongoose.disconnect();
    console.log('\n👋 Déconnexion');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

checkPaiements();
