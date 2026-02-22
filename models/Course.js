// models/Course.js

const mongoose = require('mongoose');

const semestre1Schema = new mongoose.Schema({
  p1: { type: Number, default: 0 },
  p2: { type: Number, default: 0 },
  examen: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const semestre2Schema = new mongoose.Schema({
  p3: { type: Number, default: 0 },
  p4: { type: Number, default: 0 },
  examen: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

const courseSchema = new mongoose.Schema({

  nom: {
    type: String,
    required: true,
    trim: true
  },

  classe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classe',
    required: true
  },

  heures: {
  type: String,
  default: "0H",
  trim: true
},


  ponderation: {
    type: Number,
    default: 1
  },

  semestre1: semestre1Schema,
  semestre2: semestre2Schema,

  totalGeneral: {
    type: Number,
    default: 0
  },

  anneeScolaire: {
    type: String,
    required: true
  }

}, { timestamps: true });

// 🔐 Sécurité anti doublon
courseSchema.index(
  { nom: 1, classe: 1, anneeScolaire: 1 },
  { unique: true }
);

module.exports = mongoose.model('Course', courseSchema);
