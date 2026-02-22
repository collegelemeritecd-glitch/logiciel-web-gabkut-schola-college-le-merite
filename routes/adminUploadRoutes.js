// backend/routes/adminUploadRoutes.js
const express = require('express');
const router = express.Router();

const upload = require('../middleware/uploadMiddleware'); // OU '../middlewares/uploadMiddleware' selon ton arbo
const adminUploadController = require('../controllers/admin/adminUploadController');

// IMPORTANT : PAS d'authMiddleware ici pour l'instant
router.post(
  '/upload',
  upload.single('file'),
  adminUploadController.handleUpload
);

module.exports = router;
