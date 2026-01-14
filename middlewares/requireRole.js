/************************************************************
 📘 REQUIRE ROLE MIDDLEWARE - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const requireRole = (allowedRoles = []) => {
  // Sécuriser si jamais on passe une string au lieu d'un tableau
  if (!Array.isArray(allowedRoles)) {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    // Vérifier que l'utilisateur est authentifié
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise.',
      });
    }

    // Si aucun rôle n'est spécifié, on laisse passer
    if (!allowedRoles.length) {
      return next();
    }

    // Vérifier que le rôle de l'utilisateur est autorisé
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Accès refusé. Rôle requis : ${allowedRoles.join(' ou ')}.`,
        yourRole: req.user.role,
      });
    }

    next();
  };
};

module.exports = requireRole;
