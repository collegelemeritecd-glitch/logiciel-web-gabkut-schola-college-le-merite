const express = require('express');
const router = express.Router();
const uploadTeacher = require('../middleware/uploadTeacherMiddleware');
const adminTeachersUploadController = require('../controllers/admin/adminTeachersUploadController');
const { authMiddleware, isAdmin } = require('../middlewares/authMiddleware'); // garde ton "s" ici

router.post(
  '/teachers/upload',
  authMiddleware,
  isAdmin,
  uploadTeacher.single('file'),
  adminTeachersUploadController.uploadPhoto
);

module.exports = router;
