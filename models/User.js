// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // 🔹 ajouter ceci

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Le nom complet est requis'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "L'email est requis"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email invalide'],
    },
    password: {
      type: String,
      required: [true, 'Le mot de passe est requis'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'percepteur', 'rh', 'comptable', 'teacher', 'student', 'parent'],
      required: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    isSystemAccount: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'revoked'],
      default: 'active',
    },
    mustChangePassword: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: Date,
    lastSeenAt: Date,
  },
  {
    timestamps: true,
  },
);

// 🔐 Hash automatique du mot de passe si modifié
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('User', UserSchema);
