// scripts/reset-student-parent.js
const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI;

const run = async () => {
  try {
    console.log('🌱 Reset student & parent...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    const targets = [
      {
        fullName: 'Élève Test',
        email: 'student@gabkut.com',
        password: 'student123',
        role: 'student',
      },
      {
        fullName: 'Parent Test',
        email: 'parent@gabkut.com',
        password: 'parent123',
        role: 'parent',
      },
    ];

    for (const acc of targets) {
      const deleted = await User.findOneAndDelete({ email: acc.email });
      console.log(`🗑️ Ancien ${acc.role} supprimé:`, !!deleted);

      const user = await User.create({
        fullName: acc.fullName,
        email: acc.email,
        password: acc.password, // en clair, le pre('save') va hasher
        role: acc.role,
        phone: '+243822783500',
        isSystemAccount: true,
        isActive: true,
      });

      console.log(`✅ Nouveau ${acc.role} créé:`, {
        email: user.email,
        role: user.role,
        passwordLength: user.password.length,
      });
    }

    console.log('🎉 Reset terminé pour student & parent');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur reset-student-parent:', err);
    process.exit(1);
  }
};

run();
