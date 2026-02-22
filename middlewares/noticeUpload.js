const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Dossier de destination
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'notices');

// Création du dossier si nécessaire
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-');
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  // Autoriser images et vidéos basiques
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/jpg',
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mp3', 'video/jpeg'
  ];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Type de fichier non supporté'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 Mo
  },
});

module.exports = upload;
