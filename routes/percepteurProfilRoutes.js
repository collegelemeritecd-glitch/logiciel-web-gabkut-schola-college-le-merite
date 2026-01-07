// routes/percepteurProfilRoutes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const User = require('../models/User');

const router = express.Router();

// stockage mémoire pour l'avatar (à adapter si tu veux sauver sur disque / cloud)
const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /api/percepteur/me
 * Retourne le user connecté
 */
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    return res.json({
      success: true,
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isSystemAccount: user.isSystemAccount,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('Erreur GET /percepteur/me:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * PUT /api/percepteur/me
 * Met à jour fullName, email, phone, et éventuellement password
 */
router.put('/me', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const { fullName, email, phone, currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    if (typeof fullName === 'string' && fullName.trim()) {
      user.fullName = fullName.trim();
    }
    if (typeof email === 'string' && email.trim()) {
      user.email = email.trim().toLowerCase();
    }
    if (typeof phone === 'string') {
      user.phone = phone.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Mot de passe actuel requis pour changer le mot de passe'
        });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Mot de passe actuel incorrect'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 6 caractères'
        });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
    }

    await user.save();

    return res.json({
      success: true,
      message: 'Profil mis à jour',
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isSystemAccount: user.isSystemAccount,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('Erreur PUT /percepteur/me:', err);
    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /api/percepteur/me/avatar
 * Upload avatar (ici juste simulé)
 */
router.post('/me/avatar', upload.single('avatar'), async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier envoyé' });
    }

    // Ici tu peux sauvegarder l'avatar (S3, disque, etc.) et stocker l’URL dans User
    // Ex: user.avatarUrl = '...'; await user.save();

    return res.json({
      success: true,
      message: 'Avatar mis à jour (simulation, à brancher sur ton stockage)'
    });
  } catch (err) {
    console.error('Erreur POST /percepteur/me/avatar:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

/**
 * POST /api/percepteur/me/reset
 * Réinitialise le compte aux valeurs du seed (nom, email, password, phone)
 * basé sur le rôle/role + isSystemAccount + email seedé
 */
router.post('/me/reset', async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });
    }

    if (!user.isSystemAccount) {
      return res.status(400).json({
        success: false,
        message: 'Réinitialisation réservée aux comptes système (seed)'
      });
    }

    // Mapping valeurs d’usine en fonction du rôle
    const seedDefaultsByRole = {
      admin: {
        fullName: 'Administrateur Général',
        email: 'admin@gabkut.com',
        password: 'admin123',
        phone: '+243822783500'
      },
      comptable: {
        fullName: 'Comptable Principal',
        email: 'comptable@gabkut.com',
        password: 'comptable123',
        phone: '+243822783500'
      },
      rh: {
        fullName: 'Responsable RH',
        email: 'rh@gabkut.com',
        password: 'rh123',
        phone: '+243822783500'
      },
      percepteur: {
        fullName: 'Percepteur Principal',
        email: 'percepteur@gabkut.com',
        password: 'percepteur123',
        phone: '+243822783500'
      },
      teacher: {
        fullName: 'Enseignant Test',
        email: 'teacher@gabkut.com',
        password: 'teacher123',
        phone: '+243822783500'
      },
      student: {
        fullName: 'Élève Test',
        email: 'student@gabkut.com',
        password: 'student123',
        phone: '+243822783500'
      },
      parent: {
        fullName: 'Parent Test',
        email: 'parent@gabkut.com',
        password: 'parent123',
        phone: '+243822783500'
      }
    };

    const defaults = seedDefaultsByRole[user.role];
    if (!defaults) {
      return res.status(400).json({
        success: false,
        message: 'Aucune valeur d’usine définie pour ce rôle'
      });
    }

    // On remet aux valeurs seedées
    user.fullName = defaults.fullName;
    user.email = defaults.email.toLowerCase();
    user.phone = defaults.phone;

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(defaults.password, salt);

    await user.save();

    return res.json({
      success: true,
      message: 'Profil réinitialisé aux valeurs d’usine',
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isSystemAccount: user.isSystemAccount,
        isActive: user.isActive
      }
    });
  } catch (err) {
    console.error('Erreur POST /percepteur/me/reset:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
