// models/comptable/Immobilisation.js
const mongoose = require('mongoose');

const schemaPlanAmortissement = new mongoose.Schema({
  periode: { type: String, required: true },  // ex: '2026-01' ou '2026'
  dateDebut: { type: Date, required: true },
  dateFin: { type: Date, required: true },
  dotation: { type: Number, required: true },
  amortCumul: { type: Number, required: true },
  vnc: { type: Number, required: true },
  ecriture: { type: mongoose.Schema.Types.ObjectId, ref: 'EcritureComptable', default: null }
}, { _id: false });

const immobilisationSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  libelle: { type: String, required: true },

  // Comptes
  compteImmobilisation: { type: String, required: true },   // ex: 215
  compteAmortissement: { type: String, required: true },    // ex: 2815
  compteDotation: { type: String, required: true },         // ex: 6811

  dateAcquisition: { type: Date, required: true },
  valeurOrigine: { type: Number, required: true },
  duree: { type: Number, required: true }, // années
  mode: { type: String, enum: ['lineaire'], default: 'lineaire' },

  // Suivi amortissement
  taux: { type: Number, required: true },            // pour info
  amortCumul: { type: Number, default: 0 },          // cumulé
  vnc: { type: Number, default: 0 },                 // valeur nette comptable
  estCloturee: { type: Boolean, default: false },

  plan: [schemaPlanAmortissement]                    // plan théorique + lien aux écritures
}, {
  timestamps: true
});

// Calcul VNC avant save
immobilisationSchema.pre('save', function (next) {
  const immo = this;
  const cumul = immo.amortCumul || 0;
  immo.vnc = Math.max(0, (immo.valeurOrigine || 0) - cumul);
  if (immo.vnc === 0) immo.estCloturee = true;
  next();
});

module.exports = mongoose.model('Immobilisation', immobilisationSchema);
