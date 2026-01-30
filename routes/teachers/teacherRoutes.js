// routes/teachers/teacherRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/requireRole");

const teacherController = require('../../controllers/teachers/teacherController');

// Protection globale
router.use(authMiddleware);
router.use(requireRole(["teacher"]));

router.get('/me/overview', teacherController.getOverview);
router.get('/me/courses', teacherController.getCourses);

router.get('/me/grades', teacherController.getGrades);
router.post('/me/grades', teacherController.saveGrades);

router.get('/me/attendance', teacherController.getAttendance);
router.post('/me/attendance', teacherController.saveAttendance);

router.get('/me/bulletins', teacherController.getBulletins);

router.post('/me/courses', teacherController.createCourse);
router.put('/me/courses/:id', teacherController.updateCourse);
router.delete('/me/courses/:id', teacherController.deleteCourse);

// Export XLSX des notes d'une classe/période
router.get('/me/grades/export-xlsx', teacherController.exportGradesXlsx);

// Récapitulatif de toutes les notes de l'enseignant
router.get('/me/grades/recap', teacherController.getGradesRecap);

// Export XLSX du récapitulatif
router.get('/me/grades/recap-export-xlsx', teacherController.exportGradesRecapXlsx);

router.post('/me/grades/recap-edit', teacherController.saveRecapGrades);

module.exports = router;
