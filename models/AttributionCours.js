// models/AttributionCours.js
const mongoose = require('mongoose');

const AttributionCoursSchema = new mongoose.Schema(
  {
    // Enseignant concerné
    enseignant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enseignant',
      required: true,
      index: true,
    },

    // Classe concernée
    classe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classe', // adapte au nom de ton modèle de classe
      required: true,
      index: true,
    },

    // Discipline / branche
    discipline: {
      type: String, // ex: "MATH", "FRANÇAIS", "PEDAGOGIE"
      required: true,
      trim: true,
      uppercase: true,
    },

    // Nombre d'heures hebdomadaires
    heures: {
      type: Number,
      min: 0,
      required: true,
    },

    // Ponderation globale (ex: 50, 30, 20...)
    ponderation: {
      type: Number,
      min: 0,
      required: true,
    },

    // Clé "année scolaire" pour filtrer
    anneeScolaire: {
      type: String, // ex: "2025-2026"
      required: true,
      index: true,
    },

    // Optionnel : type de section / filière (HP, CG, etc.)
    section: {
      type: String,
      trim: true,
      uppercase: true,
    },

    // Optionnel : remarques internes
    note: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AttributionCours', AttributionCoursSchema);
