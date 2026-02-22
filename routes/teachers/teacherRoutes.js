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
router.get('/me/bulletins/:id', teacherController.getBulletinDetail);
router.get('/export/classes-cours', teacherController.exportTeacherClassesExcel);


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

// Récapitulatif des présences (période)
router.get('/me/attendance-recap', teacherController.getAttendanceRecap);

// Export XLSX du récapitulatif des présences
router.get('/me/attendance-recap-export-xlsx', teacherController.exportAttendanceRecapXlsx);
// Exemple : route générique pour CPE/direction
router.get('/me/attendance-at-risk', teacherController.getAttendanceAtRisk);
// Actions automatiques assiduité (avertissements à partir du mensuel)
router.post('/me/monthly-attendance-actions', teacherController.triggerMonthlyAttendanceActions);

// Récapitulatif mensuel des présences (GET + POST + PUT)
router.get('/me/monthly-attendance', teacherController.getMonthlyAttendance);
router.post('/me/monthly-attendance', teacherController.createMonthlyAttendance);
router.put('/me/monthly-attendance', teacherController.updateMonthlyAttendance);

// Export XLSX mensuel des présences
router.get('/me/monthly-attendance-export-xlsx', teacherController.exportMonthlyAttendanceXlsx);

module.exports = router;
