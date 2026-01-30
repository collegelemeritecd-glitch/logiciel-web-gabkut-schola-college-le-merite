// controllers/admin/adminTeachersController.js
const Enseignant = require('../../models/Enseignant');
const User = require('../../models/User'); // adapte le chemin si besoin
const { nanoid } = require('nanoid');
const crypto = require('crypto');
const {
  sendUserWelcomeEmail,
} = require('../../services/emailService'); // adapte le chemin

/**
 * GET /api/admin/teachers
 */
exports.getTeachers = async (req, res, next) => {
  try {
    const { anneeScolaire, statut, fonction } = req.query;

    const filter = {};
    if (anneeScolaire) filter.anneeScolaire = anneeScolaire;
    if (statut) filter.statut = statut;
    if (fonction) filter.fonction = fonction;

    const teachers = await Enseignant.find(filter).lean();

    return res.json({
      success: true,
      teachers,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/teachers/:id
 */
exports.getTeacherById = async (req, res, next) => {
  try {
    const teacher = await Enseignant.findById(req.params.id).lean();

    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: 'Enseignant introuvable' });
    }

    return res.json({ success: true, teacher });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/teachers
 * - Crée l'enseignant
 * - Crée un User (role teacher) si non fourni et si email inexistant
 * - Réutilise le User existant si l'email existe déjà
 * - Envoie l'email de bienvenue seulement en cas de nouveau User
 */
exports.createTeacher = async (req, res, next) => {
  try {
    const payload = { ...req.body };

    // Normaliser
    if (payload.email) {
      payload.email = String(payload.email).toLowerCase().trim();
    }
    if (payload.nom) payload.nom = String(payload.nom).toUpperCase().trim();
    if (payload.postnom)
      payload.postnom = String(payload.postnom).toUpperCase().trim();
    if (payload.prenom)
      payload.prenom = String(payload.prenom).toUpperCase().trim();

    let userId = payload.user;

    if (!userId) {
      if (!payload.email) {
        return res.status(400).json({
          success: false,
          message:
            "L'email est requis pour créer un compte utilisateur enseignant.",
        });
      }

      const fullName = [payload.nom, payload.postnom, payload.prenom]
        .filter(Boolean)
        .join(' ')
        .trim();

      const existingUser = await User.findOne({ email: payload.email }).lean();

      if (existingUser) {
        userId = existingUser._id;
      } else {
        // 🔐 Mot de passe basé sur le prénom: prenom123
        const base =
          (payload.prenom || fullName || 'prof')
            .split(' ')[0]              // prendre le premier mot
            .normalize('NFD')            // enlever accents
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
        const tempPassword = `${base}123`;

        const user = await User.create({
          fullName,
          email: payload.email,
          role: 'teacher',
          password: tempPassword,  // hook Mongoose hash
          isActive: true,
        });

        userId = user._id;

        try {
          await sendUserWelcomeEmail({
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            tempPassword, // affiché dans le mail
            // à toi d’ajouter dans emailService un BCC vers kutalagael2@gmail.com
          });
        } catch (mailErr) {
          console.error('❌ Erreur envoi email enseignant:', mailErr);
        }
      }
    }

    payload.user = userId;

    if (!payload.matricule) {
      const timePart = Date.now().toString().slice(-5);
      const randomPart = nanoid(3).toUpperCase();
      payload.matricule = `T-${timePart}-${randomPart}`;
    }

    const teacher = await Enseignant.create(payload);

    return res.status(201).json({ success: true, teacher });
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
 */
exports.updateTeacher = async (req, res, next) => {
  try {
    const teacher = await Enseignant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: 'Enseignant introuvable' });
    }

    return res.json({ success: true, teacher });
  } catch (err) {
    console.error('❌ Erreur update enseignant:', err);
    return next(err);
  }
};

/**
 * DELETE /api/admin/teachers/:id
 */
exports.deleteTeacher = async (req, res, next) => {
  try {
    const teacher = await Enseignant.findByIdAndDelete(req.params.id);

    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, message: 'Enseignant introuvable' });
    }

    return res.json({ success: true, message: 'Enseignant supprimé' });
  } catch (err) {
    return next(err);
  }
};
