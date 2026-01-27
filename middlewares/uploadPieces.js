const multer = require("multer");
const path = require("path");
const fs = require("fs");

// dossier de stockage local ex: ./uploads/pieces
const uploadDir = path.join(__dirname, "..", "uploads", "pieces");

// s'assurer que le dossier existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, unique + ext);
  },
});

function fileFilter(req, file, cb) {
  // ici tu peux limiter aux PDF, images, etc.
  // ex: if (!file.mimetype.startsWith("image/") && file.mimetype !== "application/pdf")...
  cb(null, true);
}

const uploadPieces = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 Mo max
  },
});

// plusieurs pièces => field name "pieces"
const uploadPiecesMiddleware = uploadPieces.array("pieces", 10);

module.exports = uploadPiecesMiddleware;
