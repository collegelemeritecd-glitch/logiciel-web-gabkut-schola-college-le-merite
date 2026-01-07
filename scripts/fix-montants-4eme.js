/****************************************************************
 🔧 MIGRATION : MISE À JOUR MONTANTS 4ème → 400 USD
 Backend Node.js - Gabkut Agency LMK +243822783500
================================================================ */

const mongoose = require('mongoose');
require('dotenv').config();

const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');

const MONGODB_URI = process.env.MONGODB_URI;

const mettreAJourMontants = async () => {
  try {
    console.log('🔧 Démarrage mise à jour montants 4ème...');

    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    // 1️⃣ Récupérer toutes les classes de 4ème
    const classes4eme = await Classe.find({ 
      nom: { $regex: /^4ème/, $options: 'i' } 
    });

    console.log(`📚 ${classes4eme.length} classes de 4ème trouvées`);

    let compteurMisAJour = 0;

    // 2️⃣ Pour chaque classe de 4ème
    for (const classe of classes4eme) {
      console.log(`\n🔍 Traitement classe : ${classe.nom}`);
      console.log(`   Montant correct : ${classe.montantFrais} USD`);

      // 3️⃣ Récupérer tous les élèves de cette classe
      const eleves = await Eleve.find({ classe: classe._id });
      console.log(`   👨‍🎓 ${eleves.length} élèves trouvés`);

      // 4️⃣ Mettre à jour chaque élève
      for (const eleve of eleves) {
        if (eleve.montantDu !== classe.montantFrais) {
          console.log(`   🔧 MAJ ${eleve.nom} ${eleve.prenom || ''} : ${eleve.montantDu} → ${classe.montantFrais} USD`);
          
          await Eleve.findByIdAndUpdate(eleve._id, {
            montantDu: classe.montantFrais
          });

          compteurMisAJour++;
        }
      }
    }

    console.log('\n🎉 ========================================');
    console.log(`✅ Mise à jour terminée !`);
    console.log(`📊 ${compteurMisAJour} élèves mis à jour`);
    console.log('🎉 ========================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur migration :', err);
    process.exit(1);
  }
};

mettreAJourMontants();
