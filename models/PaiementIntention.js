// models/PaiementIntention.js
const mongoose = require('mongoose');

const PaiementIntentionSchema = new mongoose.Schema(
  {
    // Matricule / référence élève (même que Reference côté formulaire)
    reference: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Données paiement
    montant: {
      type: Number,
      required: true,
      min: 0,
    },

    devise: {
      type: String,
      required: true,
      trim: true,
      default: 'USD',
    },

    mois: {
      type: String,
      required: true,
      enum: [
        'Septembre',
        'Octobre',
        'Novembre',
        'Décembre',
        'Janvier',
        'Février',
        'Mars',
        'Avril',
        'Mai',
        'Juin',
      ],
    },

    moyenPaiement: {
      type: String,
      enum: ['Cash', 'Espèces', 'Mobile Money', 'Virement', 'Banque', 'Chèque', 'Autre'],
      default: 'Mobile Money',
    },

    // Contacts payeur
    telephonePayer: {
      type: String,
      trim: true,
    },
    emailPayer: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Contacts parent pour le système
    emailParent: {
      type: String,
      trim: true,
      lowercase: true,
    },
    parentNom: {
      type: String,
      trim: true,
    },

    noteAdministrative: {
      type: String,
      trim: true,
    },

    // Lien éventuel vers un paiement créé
    paiementCree: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Paiement',
    },

    // Statut de l’intention
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled'],
      default: 'pending',
      index: true,
    },

    // Copie basique des infos retour MaxiCash si besoin
    lastMaxicashStatus: {
      type: String,
      trim: true,
    },
    lastTransactionId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PaiementIntention', PaiementIntentionSchema);
