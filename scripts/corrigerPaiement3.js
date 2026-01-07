/************************************************************
 📘 CORRIGER PAIEMENT MANQUANT - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

require('dotenv').config();
const mongoose = require('mongoose');

const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');
const Classe = require('../models/Classe');

async function corrigerPaiement() {
  try {
    console.log('🔧 Correction du paiement manquant...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');

    // 1. TROUVER L'ÉLÈVE
    const eleve = await Eleve.findOne({ nom: 'KUTALAKUDIMA' });
    
    if (!eleve) {
      console.log('❌ Élève KUTALAKUDIMA introuvable');
      process.exit(1);
    }

    console.log(`✅ Élève trouvé: ${eleve.nom} ${eleve.prenom || ''}`);
    console.log(`   ID: ${eleve._id}\n`);

    // 2. CORRIGER LE PAIEMENT PROBLÉMATIQUE
    const reference = 'COLM-GK-1767406145899';
    
    const result = await Paiement.updateOne(
      { reference: reference },
      {
        $set: {
          eleve: eleve._id,  // ✅ Lier à l'élève
          statut: 'validé'   // ✅ Corriger le statut
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log(`❌ Paiement ${reference} introuvable`);
      process.exit(1);
    }

    console.log(`✅ Paiement corrigé: ${reference}`);
    console.log(`   Modifié: ${result.modifiedCount} document(s)\n`);

    // 3. RECALCULER LE SOLDE DE L'ÉLÈVE
    const paiements = await Paiement.find({
      eleve: eleve._id,
      statut: 'validé'
    });

    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const classe = await Classe.findById(eleve.classe);
    const fraisTotal = classe?.montantFrais || 0;
    const resteAPayer = Math.max(0, fraisTotal - totalPaye);

    await Eleve.updateOne(
      { _id: eleve._id },
      {
        $set: {
          totalPaye,
          resteAPayer,
          montantPaye: totalPaye,
          montantDu: resteAPayer
        }
      }
    );

    console.log('📊 RÉSULTAT FINAL:');
    console.log(`   ${eleve.nom} ${eleve.prenom || ''}`);
    console.log(`   Frais classe: ${fraisTotal} USD`);
    console.log(`   Total payé: ${totalPaye} USD`);
    console.log(`   Reste à payer: ${resteAPayer} USD`);
    console.log(`   ${paiements.length} paiement(s) lié(s)\n`);

    // 4. AFFICHER LE DÉTAIL DES PAIEMENTS
    console.log('💰 DÉTAIL DES PAIEMENTS:');
    for (const p of paiements) {
      console.log(`   - ${p.mois}: ${p.montant} USD (${p.reference})`);
    }

    console.log('\n✅ Correction terminée !\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

corrigerPaiement();
