// models/DepenseBudget.js

const mongoose = require("mongoose");

const depenseBudgetSchema = new mongoose.Schema(
  {
    annee: {
      type: Number,
      required: true,
    },
    anneeScolaire: {
      type: String,
      required: true,
    },
    mois: {
      type: Number,
      required: true, // 1-12, pour "fixe" on mettra 0 via le front
      min: 0,
      max: 12,
    },
    type: {
      type: String,
      enum: ["fixe", "variable", "credit", "epargne"],
      required: true,
    },

    // ===== ANCIENS CHAMPS (on les garde pour compat éventuelle) =====
    libelle: {
      type: String,
      trim: true,
    },
    montantPrevu: {
      type: Number,
      default: 0,
    },
    montantReel: {
      type: Number,
      default: 0,
    },
    classeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classe",
    },
    compteNumero: {
      type: String,
    },

    // ===== NOUVEAUX CHAMPS ALIGNÉS AVEC LE CONTROLLER =====
    // nom de la ligne dans les paramètres (ex: "Loyer", "Salaire profs")
    categorie: {
      type: String,
      required: true,
      trim: true,
    },
    prevu: {
      type: Number,
      default: 0,
    },
    reel: {
      type: Number,
      default: 0,
    },

    // mapping vers le plan comptable (par préfixes de comptes)
    // ex: ["613", "6131", "5121"]
    comptesPrefixes: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

depenseBudgetSchema.index({
  annee: 1,
  anneeScolaire: 1,
  mois: 1,
  type: 1,
  categorie: 1,
});

module.exports = mongoose.model("DepenseBudget", depenseBudgetSchema);
