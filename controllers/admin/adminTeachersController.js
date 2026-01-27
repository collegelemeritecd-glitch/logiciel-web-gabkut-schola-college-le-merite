const Enseignant = require('../../models/Enseignant');
const { nanoid } = require('nanoid'); // Utilise la version 3.3.4 pour la compatibilité require [web:11]

/**
 * GET /api/admin/teachers
 * Récupère la liste des enseignants (filtrable par année scolaire)
 */
exports.getTeachers = async (req, res, next) => {
  try {
    const { anneeScolaire } = req.query;
    const filter = {};
    if (anneeScolaire) filter.anneeScolaire = anneeScolaire;

    const teachers = await Enseignant.find(filter).lean();

    res.json({
      success: true,
      teachers,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/teachers/:id
 * Récupère un enseignant spécifique par son ID MongoDB
 */
exports.getTeacherById = async (req, res, next) => {
  try {
    const teacher = await Enseignant.findById(req.params.id).lean();
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Enseignant introuvable' });
    }
    res.json({ success: true, teacher });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/teachers
 * Crée un nouvel enseignant avec génération automatique de matricule
 */
exports.createTeacher = async (req, res, next) => {
  try {
    const payload = { ...req.body };

    // Génération automatique du matricule si non fourni
    // Format: T-XXXXX-YYY (T-5 derniers chiffres du timestamp-3 caractères aléatoires)
    if (!payload.matricule) {
      const timePart = Date.now().toString().slice(-5);
      const randomPart = nanoid(3).toUpperCase(); // NanoID est plus robuste que shortid [web:5][web:11]
      payload.matricule = `T-${timePart}-${randomPart}`;
    }

    const teacher = await Enseignant.create(payload);
    res.status(201).json({ success: true, teacher });
  } catch (err) {
    console.error('❌ Validation enseignant:', err.errors || err);
    return res.status(400).json({
      success: false,
      message: 'Erreur de validation',
      errors: err.errors,
    });
  }
};

/**
 * PUT /api/admin/teachers/:id
 * Met à jour les informations d'un enseignant
 */
exports.updateTeacher = async (req, res, next) => {
  try {
    const teacher = await Enseignant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Enseignant introuvable' });
    }
    res.json({ success: true, teacher });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/admin/teachers/:id
 * Supprime un enseignant de la base de données
 */
exports.deleteTeacher = async (req, res, next) => {
  try {
    const teacher = await Enseignant.findByIdAndDelete(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Enseignant introuvable' });
    }
    res.json({ success: true, message: 'Enseignant supprimé' });
  } catch (err) {
    next(err);
  }
};
