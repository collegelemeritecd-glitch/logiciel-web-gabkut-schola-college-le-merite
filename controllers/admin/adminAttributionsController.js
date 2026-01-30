// controllers/admin/adminAttributionsController.js
const AttributionCours = require('../../models/AttributionCours');
const Enseignant = require('../../models/Enseignant');
const Classe = require('../../models/Classe'); // adapte le chemin / nom

/**
 * GET /api/admin/attributions
 * Filtres possibles: anneeScolaire, enseignant, classe, discipline
 */
exports.getAttributions = async (req, res, next) => {
  try {
    const { anneeScolaire, enseignant, classe, discipline } = req.query;

    const filter = {};
    if (anneeScolaire) filter.anneeScolaire = anneeScolaire;
    if (enseignant) filter.enseignant = enseignant;
    if (classe) filter.classe = classe;
    if (discipline) filter.discipline = discipline.toUpperCase();

    const attributions = await AttributionCours.find(filter)
      .populate('enseignant', 'nom postnom prenom disciplinePrincipale')
      .populate('classe', 'nom niveau')
      .lean();

    return res.json({ success: true, attributions });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/attributions
 * Body: { enseignant, classe, discipline, heures, ponderation, anneeScolaire, section?, note? }
 */
exports.createAttribution = async (req, res, next) => {
  try {
    const payload = { ...req.body };

    // Normalisation
    if (payload.discipline) {
      payload.discipline = String(payload.discipline).toUpperCase().trim();
    }

    // Vérifier que l'enseignant existe
    const teacherExists = await Enseignant.exists({ _id: payload.enseignant });
    if (!teacherExists) {
      return res
        .status(400)
        .json({ success: false, message: 'Enseignant invalide' });
    }

    // Vérifier que la classe existe
    const classeExists = await Classe.exists({ _id: payload.classe });
    if (!classeExists) {
      return res
        .status(400)
        .json({ success: false, message: 'Classe invalide' });
    }

    const attribution = await AttributionCours.create(payload);

    return res.status(201).json({ success: true, attribution });
  } catch (err) {
    console.error('❌ Erreur création attribution:', err.errors || err);
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: err.errors,
    });
  }
};

/**
 * PUT /api/admin/attributions/:id
 */
exports.updateAttribution = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (payload.discipline) {
      payload.discipline = String(payload.discipline).toUpperCase().trim();
    }

    const attribution = await AttributionCours.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    );

    if (!attribution) {
      return res
        .status(404)
        .json({ success: false, message: 'Attribution introuvable' });
    }

    return res.json({ success: true, attribution });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/attributions/:id
 */
exports.deleteAttribution = async (req, res, next) => {
  try {
    const attribution = await AttributionCours.findByIdAndDelete(
      req.params.id
    );

    if (!attribution) {
      return res
        .status(404)
        .json({ success: false, message: 'Attribution introuvable' });
    }

    return res.json({ success: true, message: 'Attribution supprimée' });
  } catch (err) {
    return next(err);
  }
};
