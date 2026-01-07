/****************************************************************
 📘 GABKUT-SCHOLA — SEED 43 CLASSES USD COLLÈGE LE MÉRITE
 Backend Node.js - Gabkut Agency LMK +243822783500
================================================================ */

const mongoose = require('mongoose');
require('dotenv').config();

const Classe = require('../models/Classe');

const MONGODB_URI = process.env.MONGODB_URI;
const ANNEE_SCOLAIRE = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

const seedClasses = async () => {
  try {
    console.log('🌱 Démarrage seed 43 classes - Collège Le Mérite...');

    // Connexion MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    const classes = [
      // 🏫 MATERNELLE
      { nom: '1ère année Maternelle', niveau: 'Maternelle', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème année Maternelle', niveau: 'Maternelle', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème année Maternelle', niveau: 'Maternelle', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },

      // 🏫 PRIMAIRE
      { nom: '1ère année Primaire', niveau: 'Primaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème année Primaire', niveau: 'Primaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème année Primaire', niveau: 'Primaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème année Primaire', niveau: 'Primaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '5ème année Primaire', niveau: 'Primaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '6ème année Primaire', niveau: 'Primaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },

      // 🏫 SECONDAIRE
      { nom: '7ème année', niveau: 'Secondaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '8ème année', niveau: 'Secondaire', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },

      // 🏫 COLLÈGE (1ère)
      { nom: '1ère Littéraire', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '1ère Scientifiques', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '1ère Pédagogie', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '1ère Commerciale et gestion', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '1ère Coupe et couture', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '1ère Électricité', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '1ère Mécanique Générale', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '1ère Mécanique Automobile', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },

      // 🏫 COLLÈGE (2ème)
      { nom: '2ème Commerciale et gestion', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème Coupe et couture', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème Électricité', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème Mécanique Générale', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème Mécanique Automobile', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème Humanité Pédagogique', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème Humanité Sciences', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '2ème Humanité Littéraire', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },

      // 🏫 COLLÈGE (3ème)
      { nom: '3ème Littéraire', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème Scientifiques', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème Pédagogie', niveau: 'Collège', montantFrais: 300, mensualite: 30, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème Commerciale et gestion', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème Coupe et couture', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème Électricité', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème Mécanique Générale', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '3ème Mécanique Automobile', niveau: 'Collège', montantFrais: 350, mensualite: 35, anneeScolaire: ANNEE_SCOLAIRE },

      // 🏫 COLLÈGE (4ème)
      { nom: '4ème Littéraire', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème Scientifiques', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème Pédagogie', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème Commerciale et gestion', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème Coupe et couture', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème Électricité', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème Mécanique Générale', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      { nom: '4ème Mécanique Automobile', niveau: 'Collège', montantFrais: 400, mensualite: 40, anneeScolaire: ANNEE_SCOLAIRE },
      
    ];

    // Compter les classes existantes
    const totalExistantes = await Classe.countDocuments();
    console.log(`📊 Classes actuelles dans la base : ${totalExistantes}`);

    if (totalExistantes >= classes.length) {
      console.log('');
      console.log('✅ ========================================');
      console.log('✅ Toutes les classes existent déjà !');
      console.log(`📊 Total classes : ${totalExistantes}`);
      console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
      console.log('✅ ========================================');
      console.log('');
      process.exit(0);
    }

    let compteurCrees = 0;
    let compteurExistants = 0;

    // Créer les classes une par une avec gestion d'erreur
    for (const classeData of classes) {
      try {
        // Vérifier si existe déjà
        const existing = await Classe.findOne({ nom: classeData.nom });

        if (existing) {
          compteurExistants++;
          continue;
        }

        // Créer la classe
        const classe = await Classe.create(classeData);
        console.log(`✅ Classe créée : ${classe.nom} - ${classe.montantFrais} USD`);
        compteurCrees++;
      } catch (err) {
        if (err.code === 11000) {
          // Erreur doublon (déjà existe)
          console.log(`ℹ️  Classe existante : ${classeData.nom}`);
          compteurExistants++;
        } else {
          // Autre erreur
          console.error(`❌ Erreur création ${classeData.nom}:`, err.message);
        }
      }
    }

    console.log('');
    console.log('🎉 ========================================');
    console.log(`✅ Seed classes terminé !`);
    console.log(`📊 ${compteurCrees} nouvelles classes créées`);
    console.log(`ℹ️  ${compteurExistants} classes déjà existantes`);
    console.log(`📚 Total classes : ${compteurCrees + compteurExistants}`);
    console.log(`📅 Année scolaire : ${ANNEE_SCOLAIRE}`);
    console.log(`💰 Devise : USD`);
    console.log('🎉 ========================================');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-classes :', err);
    process.exit(1);
  }
};

seedClasses();
