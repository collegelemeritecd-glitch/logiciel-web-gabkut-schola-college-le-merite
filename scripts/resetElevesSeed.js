// scripts/resetElevesSeed.js
require('dotenv').config();
const mongoose = require('mongoose');

const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');
const Classe = require('../models/Classe');
const { genererMatriculePro } = require('../utils/matriculePro');

// 🔑 Gestion des différentes clés possibles
const MONGO_URI =
  process.env.MONGO_URI ||
  process.env.DB_URI ||
  process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI manquant. Vérifie ton .env ou passe la variable en ligne de commande.');
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI, {
      // les options sont devenues optionnelles mais restent acceptées
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Connecté à MongoDB');

    // 1) CIBLAGE DES ELEVES SEEDES
    // 👉 Ici on vide TOUT (base élèves vide)
    const CRITERE_SEED = {}; // supprime tous les élèves + paiements associés

    const elevesSeed = await Eleve.find(CRITERE_SEED).lean();
    const idsElevesSeed = elevesSeed.map((e) => e._id);

    console.log(`🧹 Élèves ciblés pour désseed: ${elevesSeed.length}`);

    if (idsElevesSeed.length > 0) {
      // 2) SUPPRESSION DES PAIEMENTS ASSOCIES
      const resPaiements = await Paiement.deleteMany({
        $or: [
          { eleve: { $in: idsElevesSeed } },
          { eleveId: { $in: idsElevesSeed } },
        ],
      });
      console.log(`🧾 Paiements supprimés: ${resPaiements.deletedCount}`);

      // 3) SUPPRESSION DES ELEVES
      const resEleves = await Eleve.deleteMany({ _id: { $in: idsElevesSeed } });
      console.log(`🗑️ Élèves supprimés: ${resEleves.deletedCount}`);
    } else {
      console.log('ℹ️ Aucun élève à supprimer (base déjà vide).');
    }

    // 4) AUCUN RESEED : la base reste vide
    const DO_RESEED = false;

    if (DO_RESEED) {
      console.log('🌱 Reseed de quelques élèves de démo…');

      const classes = await Classe.find().limit(3).lean();
      if (!classes.length) {
        console.warn('⚠️ Aucune classe trouvée, reseed ignoré.');
      } else {
        const anneeCourante = getAnneeScolaireCourante();

        for (const classe of classes) {
          for (let i = 1; i <= 5; i++) {
            const matricule = await genererMatriculePro();

            const eleve = new Eleve({
              matricule,
              nom: `DEMO_${classe.nom}_${i}`,
              prenom: `Prénom${i}`,
              postnom: `Postnom${i}`,
              sexe: i % 2 === 0 ? 'F' : 'M',
              age: 15 + (i % 3),
              classe: classe._id,
              anneeScolaire: anneeCourante,
              montantDu: classe.montantFrais || 0,
              montantPaye: 0,
              emailEleve: `demo_${classe.nom}_${i}@seed.test`.toLowerCase(),
              contactEleve: `0890000${String(i).padStart(2, '0')}`,
              nomParent: `Parent_DEMO_${i}`,
              telephoneParent: `0899000${String(i).padStart(2, '0')}`,
              statut: 'actif',
              dateInscription: new Date(),
            });

            await eleve.save();
            console.log('✅ Élève DEMO créé:', eleve.matricule, '-', eleve.nom);
          }
        }
      }
    }

    console.log('🎯 Désseed terminé (sans reseed). Base élèves vide.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur resetElevesSeed:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

function getAnneeScolaireCourante() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

main();
