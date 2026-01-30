// scripts/reset-teacher.js
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    // 1) Supprimer l'ancien compte teacher
    const deleted = await User.findOneAndDelete({ email: 'teacher@gabkut.com' });
    console.log('🗑️ Ancien teacher supprimé:', !!deleted);

    // 2) Recréer proprement avec le pre('save') (un seul hash)
    const user = await User.create({
      fullName: 'Enseignant Test',
      email: 'teacher@gabkut.com',
      password: 'teacher123', // en clair, pré-hook fera le hash
      role: 'teacher',
      phone: '+243822783500',
      isSystemAccount: true,
      isActive: true,
    });

    console.log('✅ Nouveau teacher créé:', {
      email: user.email,
      role: user.role,
      passwordLength: user.password.length,
    });

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur reset-teacher:', err);
    process.exit(1);
  }
};

run();
