const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    console.log(`🔐 Tentative connexion: ${email}`);

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log(`❌ Utilisateur introuvable: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log(`❌ Mot de passe incorrect pour: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    if (!user.isActive) {
      console.log(`❌ Compte désactivé: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administrateur.'
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '30d'
      }
    );

    console.log(`✅ Token généré pour: ${user.email} (${user.role})`);

    // Mettre à jour la dernière connexion
    user.lastLogin = new Date();
    await user.save();

    // ✅ LOG OPTIONNEL (NE DOIT PAS BLOQUER)
    try {
      const LogActivite = require('../models/LogActivite');
      await LogActivite.creerLog({
        auteur: user._id,
        auteurNom: user.fullName || user.email,
        roleAuteur: user.role,
        type: 'connexion',
        nature: 'utilisateur',
        details: `Connexion réussie: ${user.email}`,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
        statut: 'success'
      });
      console.log(`📋 Log connexion créé pour: ${user.email}`);
    } catch (logErr) {
      console.error('⚠️ Erreur log connexion (non bloquant):', logErr.message);
    }

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isActive: user.isActive
      }
    });

    console.log(`✅ Connexion réussie: ${user.fullName} (${user.role})`);
  } catch (error) {
    console.error('❌ Erreur login:', error);
    next(error);
  }
};

// Logout
exports.logout = async (req, res, next) => {
  try {
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('❌ Erreur logout:', error);
    next(error);
  }
};

// Verify
exports.verify = async (req, res, next) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
        isActive: req.user.isActive
      }
    });

    console.log(`✅ Token vérifié: ${req.user.email}`);
  } catch (error) {
    console.error('❌ Erreur verify:', error);
    next(error);
  }
};

console.log('✅ Auth Controller chargé');
