/************************************************************
 🔍 SCRIPT VÉRIFICATION ÉLÈVE
 Gabkut Agency LMK +243822783500
*************************************************************/

const mongoose = require('mongoose');
require('dotenv').config();

const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const Paiement = require('../models/Paiement');

async function verifierEleve() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connecté\n');

    // Rechercher l'élève par nom ou matricule
    const eleve = await Eleve.findOne({ 
      $or: [
        { nom: /KUTALAKUDIMA/i },
        { matricule: '2025-0001' }
      ]
    }).populate('classe');

    if (!eleve) {
      console.log('❌ Élève non trouvé');
      process.exit(1);
    }

    console.log('📋 ========================================');
    console.log('👤 INFORMATIONS ÉLÈVE');
    console.log('========================================');
    console.log('Nom:', eleve.nom);
    console.log('Prénom:', eleve.prenom);
    console.log('Matricule:', eleve.matricule);
    console.log('ID MongoDB:', eleve._id);
    console.log('');

    console.log('📚 CLASSE ASSIGNÉE');
    console.log('========================================');
    if (eleve.classe) {
      console.log('✅ Classe:', eleve.classe.nom);
      console.log('Niveau:', eleve.classe.niveau);
      console.log('Mensualité:', eleve.classe.mensualite, 'USD');
      console.log('Montant Frais:', eleve.classe.montantFrais, 'USD');
      console.log('Frais Annuels (x10):', eleve.classe.mensualite * 10, 'USD');
      console.log('ID Classe:', eleve.classe._id);
    } else {
      console.log('❌ AUCUNE CLASSE ASSIGNÉE');
      console.log('⚠️  classeId dans BD:', eleve.classeId || 'null');
    }
    console.log('');

    console.log('💰 PAIEMENTS');
    console.log('========================================');
    const paiements = await Paiement.find({ 
      eleveId: eleve._id,
      anneeConcernee: '2025-2026'
    }).sort({ datePaiement: -1 });

    if (paiements.length > 0) {
      console.log(`✅ ${paiements.length} paiement(s) trouvé(s):`);
      paiements.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.montant} USD - ${p.datePaiement.toLocaleDateString()} - ${p.typePaiement}`);
      });
      
      const totalPaye = paiements.reduce((sum, p) => sum + p.montant, 0);
      console.log('');
      console.log('💵 Total payé:', totalPaye, 'USD');
      
      if (eleve.classe) {
        const fraisTotal = eleve.classe.mensualite * 10;
        const resteAPayer = fraisTotal - totalPaye;
        console.log('📊 Frais totaux:', fraisTotal, 'USD');
        console.log('📉 Reste à payer:', resteAPayer, 'USD');
      }
    } else {
      console.log('❌ Aucun paiement trouvé pour 2025-2026');
    }
    console.log('');

    console.log('🔍 DIAGNOSTIC');
    console.log('========================================');
    if (!eleve.classe) {
      console.log('⚠️  PROBLÈME: L\'élève n\'a pas de classe assignée !');
      console.log('💡 SOLUTION: Assigner une classe avec le script assign-classe.js');
      
      // Suggérer des classes disponibles
      console.log('');
      console.log('📚 Classes disponibles:');
      const classesDisponibles = await Classe.find().sort({ nom: 1 }).limit(10);
      classesDisponibles.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.nom} (${c.niveau}) - ${c.mensualite} USD/mois`);
      });
    } else {
      console.log('✅ Classe correctement assignée');
      if (!eleve.classe.montantFrais || eleve.classe.montantFrais === 0) {
        console.log('⚠️  Attention: montantFrais = 0 dans la classe');
      }
    }

    console.log('========================================\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

verifierEleve();
