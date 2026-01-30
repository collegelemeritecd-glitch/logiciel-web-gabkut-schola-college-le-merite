// models/Enseignant.js
const mongoose = require('mongoose');

const EnseignantSchema = new mongoose.Schema(
  {
    // Lien avec le compte utilisateur (obligatoire chez toi)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Matricule interne prof (T-XXXXX-YYY)
    matricule: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Identité
    nom: {
      type: String,
      required: [true, 'Le nom est requis'],
      trim: true,
      uppercase: true,
    },
    postnom: {
      type: String,
      trim: true,
      uppercase: true,
    },
    prenom: {
      type: String,
      trim: true,
      uppercase: true,
    },

    sexe: {
      type: String,
      enum: ['M', 'F'],
    },

    dateNaissance: {
      type: Date,
    },

    // Contact
    telephone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Infos professionnelles “RH”
    qualification: {
      type: String, // ex: "L2 SC EDUCATION", "G3 FLAT"
      trim: true,
    },
    option: {
      type: String, // option / filière d’étude
      trim: true,
    },
    anciennete: {
      type: String, // ex: "5 ANS"
      trim: true,
    },

    // Champs que tu avais déjà
    specialite: {
      type: String,
      trim: true,
    },
    dateEmbauche: {
      type: Date,
    },
    salaire: {
      type: Number,
      min: 0,
    },

    // Type de contrat
    typeContrat: {
      type: String,
      enum: ['CDI', 'CDD', 'VACATAIRE', 'STAGIAIRE', 'AUTRE'],
      default: 'AUTRE',
    },

    // Fonction dans l’école
    fonction: {
      type: String,
      enum: [
        'PROF',
        'PREFET',
        'DIRECTEUR',
        'DIRECTRICE',
        'EDUCATEUR',
        'OUVRIER',
        'AUTRE',
      ],
      default: 'PROF',
    },

    // Discipline principale (affichage admin)
    disciplinePrincipale: {
      type: String, // ex: "Math", "Français", ...
      trim: true,
    },

    // Statut dans l’école (on garde ta version en minuscules)
    statut: {
      type: String,
      enum: ['actif', 'inactif', 'congé'],
      default: 'actif',
      index: true,
    },

    // Année scolaire de référence (pour filtrer / historiser)
    anneeScolaire: {
      type: String, // ex: "2025-2026"
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Enseignant', EnseignantSchema);
