// models/TeacherCourse.js
const mongoose = require('mongoose');

/************************************************************
 📘 GABKUT SCHOLA — MODÈLE ATTRIBUTION COURS ENSEIGNANT
 Collège Le Mérite - Backend Node.js
 - Liaison enseignant ↔ classe ↔ discipline ↔ option
*************************************************************/

const TeacherCourseSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Classe attribuée (référence à ton modèle Classe)
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classe',
      required: true,
      index: true,
    },
    className: {
      type: String,
      required: true,
      trim: true,
    },

    // Discipline / branche
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Matiere', // adapte au nom réel
      required: false,
      index: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },

    // Option / section (CG, SC, HP, EB, TCC, MA...)
    optionCode: {
      type: String,
      trim: true,
      index: true,
    },
    optionLabel: {
      type: String,
      trim: true,
    },

    // Périodes couvertes (P1-P6/EX)
    periodsLabel: {
      type: String,
      default: 'P1-P6 / EX',
    },

    // Pondération globale éventuelle
    weight: {
      type: Number,
      default: 0,
    },

    // Métadonnées établissement
    schoolYear: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ecole',
    },
  },
  {
    timestamps: true,
  }
);

TeacherCourseSchema.index(
  { teacher: 1, classId: 1, subjectName: 1, schoolYear: 1 },
  { unique: false }
);

module.exports = mongoose.model('TeacherCourse', TeacherCourseSchema);
