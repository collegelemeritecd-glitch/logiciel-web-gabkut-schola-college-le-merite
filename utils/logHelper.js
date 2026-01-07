/************************************************************
 📘 LOG HELPER - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const LogActivite = require('../models/LogActivite');

/**
 * Enregistre un paiement dans les logs
 */
exports.logPaiement = async (user, paiement, message, req = null) => {
  try {
    const metadata = req ? {
      ip: req.ip || req.connection?.remoteAddress || 'Inconnu',
      userAgent: req.get('user-agent') || 'Inconnu',
      method: req.method,
      url: req.originalUrl || req.url
    } : {};

    // ✅ Utiliser la méthode statique creerLog
    await LogActivite.creerLog({
      auteur: user._id,
      auteurNom: user.fullName || user.email,
      roleAuteur: user.role,
      type: 'paiement',
      nature: 'paiement',
      details: message,
      cible: paiement._id,
      cibleType: 'Paiement',
      metadata: metadata,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      statut: 'success'
    });

    console.log(`📝 Log paiement créé: ${message}`);
  } catch (error) {
    console.error('⚠️ Erreur log paiement (non bloquant):', error.message);
  }
};

/**
 * Enregistre une modification dans les logs
 */
exports.logModification = async (user, type, cibleId, avant, apres, message, req = null) => {
  try {
    const metadata = req ? {
      ip: req.ip || req.connection?.remoteAddress || 'Inconnu',
      userAgent: req.get('user-agent') || 'Inconnu',
      method: req.method,
      url: req.originalUrl || req.url
    } : {};

    await LogActivite.creerLog({
      auteur: user._id,
      auteurNom: user.fullName || user.email,
      roleAuteur: user.role,
      type: 'modification',
      nature: type,
      details: message,
      cible: cibleId,
      cibleType: type.charAt(0).toUpperCase() + type.slice(1),
      anciennesDonnees: avant,
      nouvellesDonnees: apres,
      metadata: metadata,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      statut: 'success'
    });

    console.log(`📝 Log modification créé: ${message}`);
  } catch (error) {
    console.error('⚠️ Erreur log modification (non bloquant):', error.message);
  }
};

/**
 * Enregistre une suppression dans les logs
 */
exports.logSuppression = async (user, type, cibleId, message, req = null) => {
  try {
    const metadata = req ? {
      ip: req.ip || req.connection?.remoteAddress || 'Inconnu',
      userAgent: req.get('user-agent') || 'Inconnu',
      method: req.method,
      url: req.originalUrl || req.url
    } : {};

    await LogActivite.creerLog({
      auteur: user._id,
      auteurNom: user.fullName || user.email,
      roleAuteur: user.role,
      type: 'suppression',
      nature: type,
      details: message,
      cible: cibleId,
      cibleType: type.charAt(0).toUpperCase() + type.slice(1),
      metadata: metadata,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      statut: 'success'
    });

    console.log(`📝 Log suppression créé: ${message}`);
  } catch (error) {
    console.error('⚠️ Erreur log suppression (non bloquant):', error.message);
  }
};

/**
 * Enregistre une connexion dans les logs
 */
exports.logConnexion = async (user, req = null) => {
  try {
    const metadata = req ? {
      ip: req.ip || req.connection?.remoteAddress || 'Inconnu',
      userAgent: req.get('user-agent') || 'Inconnu',
      method: req.method,
      url: req.originalUrl || req.url
    } : {};

    await LogActivite.creerLog({
      auteur: user._id,
      auteurNom: user.fullName || user.email,
      roleAuteur: user.role,
      type: 'connexion',
      nature: 'utilisateur',
      details: `Connexion réussie: ${user.email}`,
      metadata: metadata,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      statut: 'success'
    });

    console.log(`📝 Log connexion créé: ${user.email}`);
  } catch (error) {
    console.error('⚠️ Erreur log connexion (non bloquant):', error.message);
  }
};

/**
 * Enregistre une déconnexion dans les logs
 */
exports.logDeconnexion = async (user, req = null) => {
  try {
    const metadata = req ? {
      ip: req.ip || req.connection?.remoteAddress || 'Inconnu',
      userAgent: req.get('user-agent') || 'Inconnu',
      method: req.method,
      url: req.originalUrl || req.url
    } : {};

    await LogActivite.creerLog({
      auteur: user._id,
      auteurNom: user.fullName || user.email,
      roleAuteur: user.role,
      type: 'deconnexion',
      nature: 'utilisateur',
      details: `Déconnexion: ${user.email}`,
      metadata: metadata,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      statut: 'success'
    });

    console.log(`📝 Log déconnexion créé: ${user.email}`);
  } catch (error) {
    console.error('⚠️ Erreur log déconnexion (non bloquant):', error.message);
  }
};

/**
 * Enregistre une erreur dans les logs
 */
exports.logErreur = async (user, type, message, erreur, req = null) => {
  try {
    const metadata = req ? {
      ip: req.ip || req.connection?.remoteAddress || 'Inconnu',
      userAgent: req.get('user-agent') || 'Inconnu',
      method: req.method,
      url: req.originalUrl || req.url
    } : {};

    await LogActivite.creerLog({
      auteur: user?._id || 'system',
      auteurNom: user?.fullName || user?.email || 'Système',
      roleAuteur: user?.role || 'system',
      type: type || 'autre',
      nature: 'autre',
      details: message,
      erreur: erreur?.message || erreur,
      metadata: metadata,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      statut: 'error'
    });

    console.log(`📝 Log erreur créé: ${message}`);
  } catch (error) {
    console.error('⚠️ Erreur log erreur (non bloquant):', error.message);
  }
};

console.log('✅ LogHelper chargé avec 6 fonctions');
