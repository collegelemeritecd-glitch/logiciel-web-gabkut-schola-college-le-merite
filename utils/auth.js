// netlify/functions/utils/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'gabkut-schola-secret-key-2025';

/**
 * Vérifie et décode le token JWT depuis les headers
 */
function verifyToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  
  if (!authHeader) {
    throw new Error('Token manquant');
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Token invalide');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    console.error('❌ Erreur vérification token:', error.message);
    throw new Error('Token invalide ou expiré');
  }
}

/**
 * Génère un token JWT
 */
function generateToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = {
  verifyToken,
  generateToken,
  JWT_SECRET,
};
