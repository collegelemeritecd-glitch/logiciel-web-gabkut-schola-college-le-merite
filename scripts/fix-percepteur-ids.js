const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Paiement = require('../models/Paiement');

async function fixPercepteurIds() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGODB_URI non défini dans .env');
      process.exit(1);
    }

    console.log('🔌 Connexion à MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connecté\n');

    const percepteurId = '694fbfea4df130a0c840f0be';

    console.log('🔍 Recherche des paiements sans percepteur...\n');
    
    // ✅ Le champ s'appelle "percepteur" et pas "percepteurId" !
    const paiementsSansPercepteur = await Paiement.countDocuments({
      $or: [
        { percepteur: { $exists: false } },
        { percepteur: null }
      ]
    });

    console.log(`📊 ${paiementsSansPercepteur} paiements sans percepteur trouvés`);

    if (paiementsSansPercepteur === 0) {
      console.log('✅ Tous les paiements ont déjà un percepteur');
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log('🔧 Mise à jour en cours...\n');

    // ✅ MISE À JOUR CORRECTE avec le bon champ
    const result = await Paiement.updateMany(
      {
        $or: [
          { percepteur: { $exists: false } },
          { percepteur: null }
        ]
      },
      { 
        $set: { 
          percepteur: new mongoose.Types.ObjectId(percepteurId),
          percepteurNom: 'Percepteur Principal',
          percepteurContact: '+243822783500',
          emailPercepteur: 'percepteur@gabkut.com'
        } 
      }
    );

    console.log(`✅ ${result.modifiedCount} paiements mis à jour avec succès\n`);
    
    // ✅ Vérification finale
    const verification = await Paiement.findOne({ 
      percepteur: new mongoose.Types.ObjectId(percepteurId) 
    });
    
    if (verification) {
      console.log('🔍 Vérification: ✅ OK\n');
      console.log('📄 Exemple paiement mis à jour:', {
        id: verification._id.toString(),
        eleve: verification.eleveNom,
        percepteur: verification.percepteur.toString(),
        percepteurNom: verification.percepteurNom,
        montant: verification.montant
      });
    } else {
      console.log('⚠️ Vérification échouée - relancer le script');
    }

    // Statistiques finales
    console.log('\n📊 STATISTIQUES FINALES:');
    const totalAvecPercepteur = await Paiement.countDocuments({
      percepteur: { $exists: true, $ne: null }
    });
    console.log(`✅ Paiements avec percepteur: ${totalAvecPercepteur}`);
    
    const totalSansPercepteur = await Paiement.countDocuments({
      $or: [
        { percepteur: { $exists: false } },
        { percepteur: null }
      ]
    });
    console.log(`❌ Paiements sans percepteur: ${totalSansPercepteur}`);
    
    await mongoose.disconnect();
    console.log('\n👋 Déconnexion MongoDB');
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

fixPercepteurIds();
