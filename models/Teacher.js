const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true }, // ex: Français, Math, ...
    category: { type: String, trim: true }, // ex: "arts", "bio-science", ...

    grade: { type: String, trim: true }, // titre / grade

    photoUrl: { type: String, trim: true }, // /uploads/images/xxx.jpg

    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    intro: { type: String, trim: true }, // texte court
    bio: { type: String, trim: true },   // biographie détaillée

    summary: [{ type: String, trim: true }], // liste d’intérêts / activités

    facebook: { type: String, trim: true },
    twitter: { type: String, trim: true },
    google: { type: String, trim: true },
    linkedin: { type: String, trim: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Teacher', teacherSchema);
