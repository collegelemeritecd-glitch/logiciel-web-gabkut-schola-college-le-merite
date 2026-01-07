/************************************************************
 📘 RECALCULER SOLDES ÉLÈVES - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

require('dotenv').config();
const mongoose = require('mongoose');

// ✅ IMPORTER TOUS LES MODÈLES
const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');
const Classe = require('../models/Classe');

async function recalculerSoldes() {
  try {
    console.log('🚀 Démarrage recalcul des soldes...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');

    const eleves = await Eleve.find().populate('classe').lean(); // ✅ LEAN pour éviter validation
    console.log(`📊 ${eleves.length} élève(s) trouvé(s)\n`);

    if (eleves.length === 0) {
      console.log('⚠️ Aucun élève trouvé dans la base de données');
      process.exit(0);
    }

    let compteurMisAJour = 0;
    let compteurSansChangement = 0;

    for (const eleve of eleves) {
      // Récupérer tous les paiements validés de cet élève
      const paiements = await Paiement.find({
        eleve: eleve._id,
        statut: 'validé'
      });

      // Calculer le total payé
      const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);

      // Calculer le reste à payer
      const fraisTotal = eleve.classe?.montantFrais || 0;
      const resteAPayer = Math.max(0, fraisTotal - totalPaye);

      // Vérifier si mise à jour nécessaire
      const ancienTotalPaye = eleve.totalPaye || 0;
      const ancienResteAPayer = eleve.resteAPayer || 0;

      if (ancienTotalPaye !== totalPaye || ancienResteAPayer !== resteAPayer) {
        // ✅ MISE À JOUR DIRECTE SANS VALIDATION
        await Eleve.updateOne(
          { _id: eleve._id },
          {
            $set: {
              totalPaye: totalPaye,
              resteAPayer: resteAPayer,
              montantPaye: totalPaye,
              montantDu: resteAPayer
            }
          }
        );

        console.log(`✅ ${eleve.nom} ${eleve.prenom || ''} (${eleve.classe?.nom || 'Sans classe'})`);
        console.log(`   Frais classe : ${fraisTotal} USD`);
        console.log(`   Ancien : ${ancienTotalPaye} USD payé | Reste : ${ancienResteAPayer} USD`);
        console.log(`   Nouveau : ${totalPaye} USD payé | Reste : ${resteAPayer} USD`);
        console.log(`   📝 ${paiements.length} paiement(s) trouvé(s)\n`);

        compteurMisAJour++;
      } else {
        compteurSansChangement++;
      }
    }

    console.log('\n🎉 ========================================');
    console.log('✅ Recalcul terminé !');
    console.log(`📊 ${compteurMisAJour} élève(s) mis à jour`);
    console.log(`✓  ${compteurSansChangement} élève(s) déjà à jour`);
    console.log(`📚 Total élèves : ${eleves.length}`);
    console.log('🎉 ========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur recalcul:', error);
    process.exit(1);
  }
}

recalculerSoldes();
