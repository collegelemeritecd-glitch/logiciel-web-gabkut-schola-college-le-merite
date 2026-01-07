/************************************************************
 📘 ADMIN STATS CONTROLLER
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const User = require('../../models/User');
const Eleve = require('../../models/Eleve');
const Classe = require('../../models/Classe');
const Paiement = require('../../models/Paiement');

exports.getStats = async (req, res, next) => {
  try {
    const anneeScolaire = req.query.anneeScolaire || process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

    console.log('📊 Stats globales pour:', anneeScolaire);

    const [
      totalUsers,
      totalTeachers,
      totalStudents,
      totalClasses,
      totalPaiements
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'teacher' }),
      Eleve.countDocuments({ statut: 'actif', anneeScolaire }),
      Classe.countDocuments({ isActive: true }),
      Paiement.countDocuments({ statut: 'validé', anneeScolaire })
    ]);

    // Compter les parents uniques
    const parentIds = await Eleve.distinct('parent', { 
      statut: 'actif', 
      anneeScolaire 
    });
    const totalParents = parentIds.filter(Boolean).length;

    res.json({
      success: true,
      totalUsers,
      totalTeachers,
      totalStudents,
      totalParents,
      totalClasses,
      totalPaiements
    });

    console.log(`📊 Stats: ${totalUsers} users, ${totalStudents} élèves, ${totalClasses} classes`);
  } catch (error) {
    console.error('❌ Erreur getStats:', error);
    next(error);
  }
};
