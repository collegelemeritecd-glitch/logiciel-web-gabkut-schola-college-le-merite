/************************************************************
 📘 GABKUT-SCHOLA — MODÈLE PARENT FUSIONNÉ PRO MAX 2026
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
 
 ✅ Compatible ancien + nouveau système
 ✅ Journal parent
 ✅ Liste parents détaillée
*************************************************************/

const mongoose = require('mongoose');

/* ------------------------------------------------------------
   🔵 Sous-document – Journal Parent
------------------------------------------------------------ */
const ParentJournalSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Père', 'Mère', 'Tuteur', 'Responsable'],
    default: 'Parent'
  },
  message: { type: String, default: '' },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

/* ------------------------------------------------------------
   🔵 Sous-document – Parent détaillé
------------------------------------------------------------ */
const ParentDetailsSchema = new mongoose.Schema({
  nom: { type: String, required: true },
  tel: { type: String },
  email: { type: String },
  sexe: {
    type: String,
    enum: ['Masculin', 'Féminin', 'Autre'],
    default: 'Autre'
  },
  adresse: { type: String },
  profession: { type: String },
  relation: {
    type: String,
    enum: [
      'Père', 'Mère', 'Tuteur', 'Tante', 'Oncle',
      'Grand-parent', 'Responsable légal', 'époux', 'épouse', 'Autre'
    ],
    default: 'Responsable légal'
  },
  modifiePar: { type: String }
}, { timestamps: true });

/* ------------------------------------------------------------
   🔵 Schéma Parent unifié
------------------------------------------------------------ */
const ParentsSchema = new mongoose.Schema({
  // Référence user (ancien système)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Référence élève (nouveau système)
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Eleve',
    index: true
  },

  // Liste enfants (ancien système)
  enfants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Eleve'
  }],

  // Infos simples (ancien système)
  profession: { type: String, trim: true },
  adresse: { type: String, trim: true },

  // Journal (ancien système)
  journal: { type: [ParentJournalSchema], default: [] },

  // Liste parents détaillée (nouveau système)
  parents: { type: [ParentDetailsSchema], default: [] }
}, {
  timestamps: true
});

module.exports = mongoose.model('ParentsModel', ParentsSchema);
