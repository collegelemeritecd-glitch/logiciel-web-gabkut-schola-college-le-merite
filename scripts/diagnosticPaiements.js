/************************************************************
 📘 DIAGNOSTIC PAIEMENTS - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

require('dotenv').config();
const mongoose = require('mongoose');

const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');
const Classe = require('../models/Classe');

async function diagnostic() {
  try {
    console.log('🔍 Démarrage diagnostic...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');

    // 1. LISTER TOUS LES ÉLÈVES
    const eleves = await Eleve.find().populate('classe').lean();
    console.log(`📊 ${eleves.length} élève(s) trouvé(s)\n`);

    for (const eleve of eleves) {
      console.log('👤 ÉLÈVE:', eleve.nom, eleve.prenom || '');
      console.log('   ID:', eleve._id);
      console.log('   Matricule:', eleve.matricule || 'Non défini');
      console.log('   Classe:', eleve.classe?.nom || 'Sans classe');
      console.log('   Frais classe:', eleve.classe?.montantFrais || 0, 'USD');
      console.log('   Total payé actuel:', eleve.totalPaye || 0, 'USD');
      console.log('   Reste à payer actuel:', eleve.resteAPayer || 0, 'USD\n');
    }

    // 2. LISTER TOUS LES PAIEMENTS
    const paiements = await Paiement.find().lean();
    console.log(`💰 ${paiements.length} paiement(s) trouvé(s)\n`);

    if (paiements.length === 0) {
      console.log('⚠️ Aucun paiement dans la base de données !');
      process.exit(0);
    }

    for (const paiement of paiements) {
      console.log('💵 PAIEMENT:');
      console.log('   ID:', paiement._id);
      console.log('   Référence:', paiement.reference || 'Non défini');
      console.log('   Montant:', paiement.montant || 0, 'USD');
      console.log('   Mois:', paiement.mois || 'Non défini');
      console.log('   Statut:', paiement.statut || 'Non défini');
      console.log('   Élève ID:', paiement.eleve || 'NON DÉFINI ❌');
      console.log('   Élève Nom:', paiement.eleveNom || 'Non défini');
      console.log('   Classe:', paiement.classe || 'Non défini');
      console.log('   Date:', paiement.datePaiement || 'Non défini');
      console.log('   Percepteur:', paiement.percepteur || 'Non défini');
      console.log('');
    }

    // 3. VÉRIFIER LES CORRESPONDANCES
    console.log('🔗 VÉRIFICATION DES CORRESPONDANCES:\n');

    for (const eleve of eleves) {
      const paiementsEleve = paiements.filter(p => {
        if (!p.eleve) return false;
        return p.eleve.toString() === eleve._id.toString();
      });

      console.log(`👤 ${eleve.nom} ${eleve.prenom || ''} (ID: ${eleve._id})`);
      console.log(`   → ${paiementsEleve.length} paiement(s) lié(s)\n`);
    }

    // 4. PAIEMENTS ORPHELINS (sans élève)
    const paiementsOrphelins = paiements.filter(p => !p.eleve);
    if (paiementsOrphelins.length > 0) {
      console.log(`⚠️ ${paiementsOrphelins.length} paiement(s) sans élève (orphelins) :\n`);
      paiementsOrphelins.forEach(p => {
        console.log(`   - Réf: ${p.reference}, Montant: ${p.montant} USD, Élève Nom: ${p.eleveNom || 'Non défini'}`);
      });
    }

    console.log('\n✅ Diagnostic terminé\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur diagnostic:', error);
    process.exit(1);
  }
}

diagnostic();
