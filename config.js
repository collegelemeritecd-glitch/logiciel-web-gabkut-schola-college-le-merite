/************************************************************
 📘 CONFIG BACKEND - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

module.exports = {
  // Année scolaire active
  ANNEE_SCOLAIRE: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
  
  // Mois scolaires
  MOIS_SCOLAIRES: [
    'Septembre', 'Octobre', 'Novembre', 'Décembre',
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'
  ],
  
  // Devise
  DEVISE: 'USD',
  
  // Nom de l'école
  ECOLE: 'Collège Le Mérite',
  
  // MongoDB
  MONGODB_URI: process.env.MONGODB_URI,
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Port serveur
  PORT: process.env.PORT || 8080
};

console.log('✅ Config Backend chargée - Année scolaire:', module.exports.ANNEE_SCOLAIRE);
