// ======================================================================
// 📘 MODEL — JournalOperation (Opération du Journal Comptable)
// Collège Le Mérite — Gabkut-Schola — Version PRO MAX 2026
// ======================================================================

const mongoose = require("mongoose");

const JournalOperationSchema = new mongoose.Schema(
  {
    // 📅 Date de l'opération principale
    date: {
      type: Date,
      required: true,
    },

    // 📝 Libellé général de l'opération
    libelle: {
      type: String,
      required: true,
      trim: true,
    },

    // 🧾 Numéro de pièce (Facture, Reçu, etc.)
    piece: {
      type: String,
      required: false,
    },

    // 🔢 Nombre total de lignes (mise à jour automatique)
    nombreLignes: {
      type: Number,
      default: 0,
    },

    // 💰 Totaux automatiques du Débit et Crédit
    totalDebit: {
      type: Number,
      default: 0,
    },

    totalCredit: {
      type: Number,
      default: 0,
    },

    numero: {
    type: String,
    required: false,
    trim: true
},


    // 📎 Pièces jointes au niveau de l’opération entière
    files: [
      {
        filename: String,
        path: String,
        mimetype: String,
        size: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.JournalOperation ||
  mongoose.model("JournalOperation", JournalOperationSchema);
