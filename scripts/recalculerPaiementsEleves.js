/************************************************************
 🔧 SCRIPT RECALCUL PAIEMENTS ÉLÈVES
 Collège Le Mérite - Gabkut Agency LMK
 
 Recalcule totalPaye et resteAPayer pour tous les élèves
*************************************************************/

require('dotenv').config();
const mongoose = require('mongoose');

// Import des modèles
const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');
const Classe = require('../models/Classe');

async function recalculerPaiements() {
  try {
    // Connexion MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connecté à MongoDB');

    const anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';
    console.log(`📅 Année scolaire: ${anneeScolaire}`);

    // 1️⃣ Récupérer tous les élèves actifs
    const eleves = await Eleve.find({
      anneeScolaire,
      isActive: true
    }).populate('classe', 'montantFrais');

    console.log(`👨‍🎓 ${eleves.length} élèves trouvés`);

    // 2️⃣ Récupérer tous les paiements validés
    const paiements = await Paiement.find({
      anneeConcernee: anneeScolaire,
      statut: 'validé'
    })
      .select('eleveId montant')
      .lean();

    console.log(`💰 ${paiements.length} paiements validés trouvés`);

    // 3️⃣ Créer une MAP des paiements par élève
    const paiementsParEleve = {};
    paiements.forEach(p => {
      const eleveIdKey = p.eleveId?.toString();
      if (!eleveIdKey) return;
      
      if (!paiementsParEleve[eleveIdKey]) {
        paiementsParEleve[eleveIdKey] = 0;
      }
      paiementsParEleve[eleveIdKey] += (p.montant || 0);
    });

    console.log(`📊 Paiements agrégés pour ${Object.keys(paiementsParEleve).length} élèves`);

    // 4️⃣ Mettre à jour chaque élève
    let updated = 0;
    let errors = 0;

    for (const eleve of eleves) {
      try {
        const eleveIdKey = eleve._id.toString();
        const totalPaye = paiementsParEleve[eleveIdKey] || 0;
        const montantFrais = eleve.classe?.montantFrais || 0;
        const resteAPayer = Math.max(0, montantFrais - totalPaye);

        await Eleve.findByIdAndUpdate(eleve._id, {
          totalPaye,
          resteAPayer,
          montantDu: montantFrais
        });

        updated++;

        if (updated % 50 === 0) {
          console.log(`⏳ ${updated}/${eleves.length} élèves mis à jour...`);
        }

        // Log détaillé pour les élèves avec paiements
        if (totalPaye > 0) {
          console.log(`✅ ${eleve.nom} ${eleve.prenom} - Payé: ${totalPaye} USD / ${montantFrais} USD`);
        }

      } catch (err) {
        console.error(`❌ Erreur pour ${eleve.nom} ${eleve.prenom}:`, err.message);
        errors++;
      }
    }

    console.log('');
    console.log('🎉 ========================================');
    console.log(`✅ ${updated} élèves mis à jour`);
    console.log(`❌ ${errors} erreurs`);
    console.log('🎉 ========================================');
    console.log('');

    // 5️⃣ Statistiques globales
    const stats = await Eleve.aggregate([
      { $match: { anneeScolaire, isActive: true } },
      {
        $group: {
          _id: null,
          totalEleves: { $sum: 1 },
          totalPaye: { $sum: '$totalPaye' },
          totalResteAPayer: { $sum: '$resteAPayer' },
          elevesAjour: {
            $sum: {
              $cond: [{ $lte: ['$resteAPayer', 0] }, 1, 0]
            }
          },
          elevesEnRetard: {
            $sum: {
              $cond: [{ $gt: ['$resteAPayer', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    if (stats.length > 0) {
      const s = stats[0];
      console.log('📊 STATISTIQUES GLOBALES:');
      console.log(`   Total élèves: ${s.totalEleves}`);
      console.log(`   Total payé: ${s.totalPaye.toFixed(2)} USD`);
      console.log(`   Total reste: ${s.totalResteAPayer.toFixed(2)} USD`);
      console.log(`   Élèves à jour: ${s.elevesAjour}`);
      console.log(`   Élèves en retard: ${s.elevesEnRetard}`);
    }

    await mongoose.disconnect();
    console.log('✅ Déconnecté de MongoDB');
    process.exit(0);

  } catch (err) {
    console.error('❌ Erreur globale:', err);
    process.exit(1);
  }
}

// Exécution
recalculerPaiements();
