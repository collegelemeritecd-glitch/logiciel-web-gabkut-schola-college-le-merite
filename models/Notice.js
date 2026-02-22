const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, trim: true },
    content: { type: String, required: true },
    date: { type: Date, required: true, default: Date.now },
    published: { type: Boolean, default: true },

    // Fichiers stockés en local, accessibles via URL statique
    imageUrl: { type: String }, // ex: /uploads/notices/xxx.jpg
    videoUrl: { type: String }, // ex: /uploads/notices/xxx.mp4 ou lien externe

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notice', noticeSchema);
