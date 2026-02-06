const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const EcritureSchema = new mongoose.Schema({
  // Référence unique de la pièce (ex: PC-X8J2)
  reference: {
    type: String,
    unique: true,
    default: () => `PC-${nanoid(6).toUpperCase()}`
  },
  dateOperation: {
    type: Date,
    required: [true, "La date de l'opération est obligatoire"],
    default: Date.now
  },
  libelle: {
    type: String,
    required: [true, "Le libellé de l'opération est obligatoire"],
    trim: true
  },
  type: {
    type: String,
    enum: ['ENTREE', 'SORTIE'],
    required: true
  },
  montant: {
    type: Number,
    required: [true, "Le montant est obligatoire"],
    min: [0, "Le montant ne peut pas être négatif"]
  },
  modePaiement: {
    type: String,
    enum: ['CASH', 'BANQUE', 'MOBILE_MONEY'],
    default: 'CASH'
  },
  compteComptable: {
    type: String,
    required: [true, "Le numéro de compte est requis pour l'audit"] // ex: 5711 pour Caisse
  },
  // Trçabilité totale
  auteur: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  notes: String
}, {
  timestamps: true // Garde trace de la date de création et de modification réelle
});

// Index pour accélérer les recherches par date et type (utile pour le Dashboard)
EcritureSchema.index({ dateOperation: -1, type: 1 });

module.exports = mongoose.model('Ecriture', EcritureSchema);
