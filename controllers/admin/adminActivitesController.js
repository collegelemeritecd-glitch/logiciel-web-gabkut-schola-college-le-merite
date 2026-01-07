/************************************************************
 📘 ADMIN ACTIVITÉS CONTROLLER
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const LogActivite = require('../../models/LogActivite');

exports.getActivites = async (req, res, next) => {
  try {
    const {
      anneeScolaire,
      mois,
      dateDebut,
      dateFin,
      classeId,
      limit = 20
    } = req.query;

    console.log('📋 Activités:', { anneeScolaire, mois, dateDebut, dateFin, classeId, limit });

    const filter = {};

    // Filtre par date
    if (dateDebut && dateFin) {
      filter.createdAt = {
        $gte: new Date(dateDebut),
        $lte: new Date(dateFin)
      };
    } else if (mois && anneeScolaire) {
      const year = parseInt(anneeScolaire.split('-')[0], 10);
      const monthInt = parseInt(mois, 10);
      const startDate = new Date(year, monthInt - 1, 1);
      const endDate = new Date(year, monthInt, 0, 23, 59, 59);
      filter.createdAt = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const logs = await LogActivite.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    res.json({
      success: true,
      logs,
      count: logs.length,
      filters: { anneeScolaire, mois, dateDebut, dateFin, classeId }
    });

    console.log(`📋 ${logs.length} activités trouvées`);
  } catch (error) {
    console.error('❌ Erreur activités:', error);
    next(error);
  }
};
