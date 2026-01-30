const mongoose = require('mongoose');

const StudentGradeSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Eleve', // adapte au nom réel
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classe',
      required: true,
    },

    // 🔴 NOUVEAU : lien direct vers TeacherCourse
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TeacherCourse',
      required: false,
    },

    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    period: {
      type: String,
      required: true,
      trim: true,
      // ex: "P1", "P2", "EX1", "P3", ...
    },
    value: {
      type: Number,
      min: 0,
      max: 100,
      required: false,
    },
    schoolYear: {
      type: String,
      required: true,
      trim: true,
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

// ancien index (sans courseId) -> on le garde si tu veux, mais le plus important est le suivant

StudentGradeSchema.index(
  { teacher: 1, student: 1, classId: 1, courseId: 1, subjectId: 1, period: 1, schoolYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('StudentGrade', StudentGradeSchema);
