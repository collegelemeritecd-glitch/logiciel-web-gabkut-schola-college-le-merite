const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // 1) Récupérer le token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant. Authentification requise.',
        code: 'NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];

    // 2) Vérifier le token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expiré. Veuillez vous reconnecter.',
          code: 'TOKEN_EXPIRED',
          expiredAt: jwtError.expiredAt
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Token invalide.',
        code: 'INVALID_TOKEN'
      });
    }

    // 3) Récupérer l'utilisateur
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur introuvable. Token invalide.',
        code: 'USER_NOT_FOUND'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Compte désactivé. Contactez l\'administrateur.',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // 4) Attacher l'utilisateur à la requête
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    console.error('❌ Erreur authMiddleware:', error.message);

    res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification.',
      code: 'AUTH_ERROR',
      error: error.message
    });
  }
};

module.exports = authMiddleware;
