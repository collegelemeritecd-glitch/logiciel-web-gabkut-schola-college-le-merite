// scripts/seed-accounts.js
const mongoose = require("mongoose");
require("dotenv").config();

const User = require("../models/User");

const MONGODB_URI = process.env.MONGODB_URI;

// Mot de passe de seed (obligatoire) -> à mettre dans le .env ou dans les secrets GitHub/serveur
// Exemple: SEED_DEFAULT_PASSWORD=ChangeMe_Strong_2026!
const SEED_DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD;

function requireEnv(name, value) {
  if (!value || String(value).trim() === "") {
    throw new Error(
      `Variable d'environnement manquante: ${name}. Ajoute-la dans .env (local) ou dans les secrets de ton hébergeur.`
    );
  }
}

const seedAccounts = async () => {
  try {
    console.log("🌱 Démarrage seed comptes système...");

    requireEnv("MONGODB_URI", MONGODB_URI);
    requireEnv("SEED_DEFAULT_PASSWORD", SEED_DEFAULT_PASSWORD);

    // Connexion MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connecté");

    // Comptes à créer (AUCUN mot de passe en clair ici)
    const accounts = [
      {
        fullName: "Administrateur Général",
        email: "admin@gabkut.com",
        role: "admin",
        phone: "+243822783500",
      },
      {
        fullName: "Comptable Principal",
        email: "comptable@gabkut.com",
        role: "comptable",
        phone: "+243822783500",
      },
      {
        fullName: "Responsable RH",
        email: "rh@gabkut.com",
        role: "rh",
        phone: "+243822783500",
      },
      {
        fullName: "Percepteur Principal",
        email: "percepteur@gabkut.com",
        role: "percepteur",
        phone: "+243822783500",
      },
      {
        fullName: "Enseignant Test",
        email: "teacher@gabkut.com",
        role: "teacher",
        phone: "+243822783500",
      },
      {
        fullName: "Élève Test",
        email: "student@gabkut.com",
        role: "student",
        phone: "+243822783500",
      },
      {
        fullName: "Parent Test",
        email: "parent@gabkut.com",
        role: "parent",
        phone: "+243822783500",
      },
    ];

    for (const acc of accounts) {
      const existing = await User.findOne({ email: acc.email });
      if (existing) {
        console.log(`ℹ️  Compte déjà existant : ${acc.email}`);
        continue;
      }

      // On laisse le pre('save') du modèle hasher le password
      const user = await User.create({
        fullName: acc.fullName,
        email: acc.email,
        password: SEED_DEFAULT_PASSWORD, // ✅ plus de password en clair dans le code
        role: acc.role,
        phone: acc.phone,
        isSystemAccount: true,
        isActive: true,
      });

      console.log(`✅ Compte créé : ${user.email} (${user.role})`);
    }

    console.log("");
    console.log("🎉 ========================================");
    console.log("✅ Seed comptes terminé !");
    console.log("");
    console.log("📋 COMPTES CRÉÉS (password = SEED_DEFAULT_PASSWORD)");
    console.log("   (Pour sécurité, on n'affiche pas le mot de passe ici)");
    console.log("");
    accounts.forEach((acc) => {
      console.log(`   ${acc.role.toUpperCase()} -> ${acc.email}`);
    });
    console.log("🎉 ========================================");
    console.log("");

    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur seed-accounts :", err.message || err);
    process.exit(1);
  }
};

seedAccounts();
