// models/Classe.js
const mongoose = require('mongoose');

const ClasseSchema = new mongoose.Schema({
  nom: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  niveau: {
    type: String,
    required: true,
    enum: ['Maternelle', 'Primaire', 'Secondaire', 'Collège']
  },
  section: {
    type: String,
    trim: true
  },
  montantFrais: {
    type: Number,
    required: true,
    min: 0
  },
  mensualite: {
    type: Number,
    required: true,
    min: 0
  },
  effectif: {
    type: Number,
    default: 0
  },
    anneeScolaire: {
    type: String,
    required: false, // ou tu supprimes carrément cette ligne "required"
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // 🔗 Titulaire de la classe (enseignant → User)
  titulaire: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Classe', ClasseSchema);
