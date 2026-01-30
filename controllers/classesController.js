// controllers/classesController.js
const Classe = require('../models/Classe');

exports.getClasses = async (req, res, next) => {
  try {
    const classes = await Classe.find({}) // pas de filtre, tu pourras raffiner après
      .sort({ niveau: 1, nom: 1 })
      .lean();

    res.json({
      success: true,
      classes: classes.map(c => ({
        id: c._id.toString(),
        name: c.nom,
        niveau: c.niveau,
      })),
    });
  } catch (err) {
    next(err);
  }
};
