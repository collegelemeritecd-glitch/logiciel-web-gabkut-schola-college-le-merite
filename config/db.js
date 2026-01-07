/************************************************************
 📘 GABKUT SCHOLA - CONFIGURATION MONGODB
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
*************************************************************/

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Options modernes (sans useNewUrlParser ni useUnifiedTopology)
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB connecté: ${conn.connection.host}`);
    console.log(`📊 Base de données: ${conn.connection.name}`);
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
