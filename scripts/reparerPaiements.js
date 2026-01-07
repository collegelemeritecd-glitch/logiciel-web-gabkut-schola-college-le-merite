/************************************************************
 📘 RÉPARER PAIEMENTS ORPHELINS - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

require('dotenv').config();
const mongoose = require('mongoose');

const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');
const Classe = require('../models/Classe');

async function reparerPaiements() {
  try {
    console.log('🔧 Démarrage réparation des paiements...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');

    // 1. RÉCUPÉRER TOUS LES ÉLÈVES
    const eleves = await Eleve.find().lean();
    console.log(`📊 ${eleves.length} élève(s) trouvé(s)\n`);

    // 2. RÉCUPÉRER TOUS LES PAIEMENTS ORPHELINS
    const paiementsOrphelins = await Paiement.find({
      $or: [
        { eleve: { $exists: false } },
        { eleve: null }
      ]
    }).lean();

    console.log(`⚠️ ${paiementsOrphelins.length} paiement(s) orphelin(s) trouvé(s)\n`);

    if (paiementsOrphelins.length === 0) {
      console.log('✅ Aucun paiement à réparer !');
      process.exit(0);
    }

    let compteurRepares = 0;
    let compteurNonRepares = 0;

    // 3. POUR CHAQUE PAIEMENT ORPHELIN
    for (const paiement of paiementsOrphelins) {
      const nomEleve = paiement.eleveNom || '';
      
      if (!nomEleve) {
        console.log(`⚠️ Paiement ${paiement.reference} : Nom d'élève manquant, ignoré\n`);
        compteurNonRepares++;
        continue;
      }

      // Chercher l'élève correspondant
      const eleveCorrespondant = eleves.find(e => {
        const nomComplet = `${e.nom} ${e.prenom || ''}`.trim().toUpperCase();
        const nomPaiement = nomEleve.trim().toUpperCase();
        
        // Correspondance exacte ou partielle
        return nomComplet.includes(nomPaiement) || nomPaiement.includes(nomComplet);
      });

      if (eleveCorrespondant) {
        // RÉPARER LE PAIEMENT
        await Paiement.updateOne(
          { _id: paiement._id },
          {
            $set: {
              eleve: eleveCorrespondant._id,  // ✅ Lier à l'élève
              statut: 'validé'  // ✅ Corriger le statut
            }
          }
        );

        console.log(`✅ Paiement réparé :`);
        console.log(`   Réf: ${paiement.reference}`);
        console.log(`   Montant: ${paiement.montant} USD`);
        console.log(`   Élève trouvé: ${eleveCorrespondant.nom} ${eleveCorrespondant.prenom || ''}`);
        console.log(`   ID élève: ${eleveCorrespondant._id}\n`);

        compteurRepares++;
      } else {
        console.log(`⚠️ Paiement ${paiement.reference} : Élève "${nomEleve}" introuvable, ignoré\n`);
        compteurNonRepares++;
      }
    }

    console.log('\n🎉 ========================================');
    console.log('✅ Réparation terminée !');
    console.log(`📊 ${compteurRepares} paiement(s) réparé(s)`);
    console.log(`⚠️ ${compteurNonRepares} paiement(s) non réparé(s)`);
    console.log('🎉 ========================================\n');

    // 4. RECALCULER LES SOLDES MAINTENANT QUE LES PAIEMENTS SONT LIÉS
    console.log('🔄 Recalcul des soldes des élèves...\n');

    for (const eleve of eleves) {
      const paiementsEleve = await Paiement.find({
        eleve: eleve._id,
        statut: 'validé'
      });

      const totalPaye = paiementsEleve.reduce((sum, p) => sum + (p.montant || 0), 0);
      const classe = await Classe.findById(eleve.classe);
      const fraisTotal = classe?.montantFrais || 0;
      const resteAPayer = Math.max(0, fraisTotal - totalPaye);

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

      if (paiementsEleve.length > 0) {
        console.log(`✅ ${eleve.nom} ${eleve.prenom || ''}`);
        console.log(`   Total payé: ${totalPaye} USD`);
        console.log(`   Reste à payer: ${resteAPayer} USD`);
        console.log(`   ${paiementsEleve.length} paiement(s) lié(s)\n`);
      }
    }

    console.log('🎉 Recalcul terminé !\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur réparation:', error);
    process.exit(1);
  }
}

reparerPaiements();
