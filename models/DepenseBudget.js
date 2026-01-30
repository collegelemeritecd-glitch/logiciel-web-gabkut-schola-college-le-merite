// models/DepenseBudget.js

const mongoose = require('mongoose');

const depenseBudgetSchema = new mongoose.Schema(
  {
    annee: {
      type: Number,
      required: true
    },
    anneeScolaire: {
      type: String,
      required: true
    },
    mois: {
      type: Number,
      required: true, // 1-12
      min: 1,
      max: 12
    },
    type: {
      type: String,
      enum: ['fixe', 'variable', 'credit', 'epargne'],
      required: true
    },
    // libellé (ex: "Loyer", "Salaire profs", "Carburant", "Epargne projet X")
    libelle: {
      type: String,
      required: true,
      trim: true
    },
    montantPrevu: {
      type: Number,
      default: 0
    },
    montantReel: {
      type: Number,
      default: 0
    },
    // si tu veux lier à une classe ou un compte comptable
    classeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classe'
    },
    compteNumero: {
      type: String // ex: "62xx", "65xx", ou compte banque pour épargne
    }
  },
  { timestamps: true }
);

depenseBudgetSchema.index({ annee: 1, anneeScolaire: 1, mois: 1, type: 1 });

module.exports = mongoose.model('DepenseBudget', depenseBudgetSchema);
