// models/Attendance.js
const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Eleve',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Classe',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    present: {
      type: Boolean,
      default: false,
    },
    absent: {
      type: Boolean,
      default: false,
    },
    late: {
      type: Boolean,
      default: false,
    },
    schoolYear: {
      type: String,
      required: true,
      trim: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
    },
  },
  {
    timestamps: true,
  }
);

AttendanceSchema.index(
  { teacher: 1, student: 1, classId: 1, date: 1, schoolYear: 1 },
  { unique: true }
);

module.exports = mongoose.model('Attendance', AttendanceSchema);
