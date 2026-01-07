const Classe = require('../../models/Classe');
const Eleve = require('../../models/Eleve');

exports.getClasses = async (req, res, next) => {
  try {
    const { niveau } = req.query;

    console.log('🏫 Admin demande liste classes, niveau:', niveau || 'tous');

    const filter = { isActive: true };
    if (niveau) filter.niveau = niveau;

    const classes = await Classe.find(filter)
      .sort({ niveau: 1, nom: 1 });

    // Calculer l'effectif pour chaque classe
    const classesWithEffectif = await Promise.all(
      classes.map(async (classe) => {
        const effectif = await Eleve.countDocuments({
          classe: classe._id,
          statut: 'actif'
        });

        return {
          ...classe.toObject(),
          effectif
        };
      })
    );

    res.json({
      success: true,
      count: classesWithEffectif.length,
      classes: classesWithEffectif
    });

    console.log(`✅ ${classesWithEffectif.length} classes envoyées`);
  } catch (error) {
    console.error('❌ Erreur classes:', error);
    next(error);
  }
};
