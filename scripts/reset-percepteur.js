// scripts/reset-percepteur.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI;

async function resetPercepteur() {
  try {
    console.log('MONGODB_URI =', MONGODB_URI);

    await mongoose.connect(MONGODB_URI);
    console.log('MongoDB connecté.');

    const defaults = {
      fullName: 'Percepteur Principal',
      email: 'percepteur@gabkut.com',
      password: 'percepteur123',
      phone: '243822783500',
    };

    let user = await User.findOne({ email: defaults.email.toLowerCase() });

    if (!user) {
      console.log('User percepteur non trouvé, abort.');
      process.exit(0);
    }

    console.log('Avant reset, hash =', user.password);

    user.fullName = defaults.fullName;
    user.email = defaults.email.toLowerCase();
    user.phone = defaults.phone;

    // ⚠️ NE PAS HASHER ICI, laisser le pre('save') du modèle faire le hash
    user.password = defaults.password;

    await user.save();

    console.log('Après reset, hash =', user.password);
    console.log('✅ Reset terminé. Nouveau mot de passe en clair =', defaults.password);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

resetPercepteur();
