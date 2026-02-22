const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Dossier de destination pour les photos d’enseignants
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'teachers');

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
  const allowed = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/jpg',
    'image/webp',
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
    fileSize: 10 * 1024 * 1024, // 10 Mo
  },
});

module.exports = upload;
