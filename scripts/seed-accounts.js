const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

const seedAccounts = async () => {
  try {
    console.log('🌱 Démarrage seed comptes système...');

    // Connexion MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connecté');

    // Comptes à créer
    const accounts = [
      {
        fullName: 'Administrateur Général',
        email: 'admin@gabkut.com',
        password: 'admin123',
        role: 'admin',
        phone: '+243822783500',
      },
      {
        fullName: 'Comptable Principal',
        email: 'comptable@gabkut.com',
        password: 'comptable123',
        role: 'comptable',
        phone: '+243822783500',
      },
      {
        fullName: 'Responsable RH',
        email: 'rh@gabkut.com',
        password: 'rh123',
        role: 'rh',
        phone: '+243822783500',
      },
      {
        fullName: 'Percepteur Principal',
        email: 'percepteur@gabkut.com',
        password: 'percepteur123',
        role: 'percepteur',
        phone: '+243822783500',
      },
      {
        fullName: 'Enseignant Test',
        email: 'teacher@gabkut.com',
        password: 'teacher123',
        role: 'teacher',
        phone: '+243822783500',
      },
      {
        fullName: 'Élève Test',
        email: 'student@gabkut.com',
        password: 'student123',
        role: 'student',
        phone: '+243822783500',
      },
      {
        fullName: 'Parent Test',
        email: 'parent@gabkut.com',
        password: 'parent123',
        role: 'parent',
        phone: '+243822783500',
      },
    ];

    for (const acc of accounts) {
      // Vérifier si déjà existant
      let existing = await User.findOne({ email: acc.email });

      if (existing) {
        console.log(`ℹ️  Compte déjà existant : ${acc.email}`);
        continue;
      }

      // Hasher le mot de passe
      const hashed = await bcrypt.hash(acc.password, BCRYPT_ROUNDS);

      // Créer l'utilisateur
      const user = await User.create({
        fullName: acc.fullName,
        email: acc.email,
        password: hashed,
        role: acc.role,
        phone: acc.phone,
        isSystemAccount: true,
        isActive: true,
      });

      console.log(`✅ Compte créé : ${user.email} (${user.role})`);
    }

    console.log('');
    console.log('🎉 ========================================');
    console.log('✅ Seed comptes terminé !');
    console.log('');
    console.log('📋 COMPTES DE TEST :');
    console.log('');
    accounts.forEach(acc => {
      console.log(`   ${acc.role.toUpperCase()}`);
      console.log(`   Email    : ${acc.email}`);
      console.log(`   Password : ${acc.password}`);
      console.log('');
    });
    console.log('🎉 ========================================');
    console.log('');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur seed-accounts :', err);
    process.exit(1);
  }
};

seedAccounts();
