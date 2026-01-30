// models/Subject.js
const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // ex: Mathématiques
    code: { type: String, trim: true },                 // ex: MATH
    shortName: { type: String, trim: true },           // optionnel
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ecole',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subject', SubjectSchema);
