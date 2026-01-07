const mongoose = require('mongoose');

const EnseignantSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  matricule: {
    type: String,
    required: true,
    unique: true
  },
  specialite: {
    type: String,
    trim: true
  },
  dateEmbauche: {
    type: Date
  },
  salaire: {
    type: Number,
    min: 0
  },
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'congé'],
    default: 'actif'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Enseignant', EnseignantSchema);
