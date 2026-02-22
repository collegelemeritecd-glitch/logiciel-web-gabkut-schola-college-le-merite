/************************************************************
 📘 ROUTES ADMIN - GABKUT SCHOLA
*************************************************************/

const express = require('express');
const router = express.Router();

// Middlewares
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Controllers - Admin
const adminStatsController = require('../controllers/admin/adminStatsController');
const adminUsersController = require('../controllers/admin/adminUsersController');
const adminClassesController = require('../controllers/admin/adminClassesController');
const adminStudentsController = require('../controllers/admin/adminStudentsController');
const adminFinanceKpisController = require('../controllers/admin/adminFinanceKpisController');
const adminActivitesController = require('../controllers/admin/adminActivitesController');
const adminReportsController = require('../controllers/admin/adminReportsController');
const adminClassesReportController = require('../controllers/admin/adminClassesReportController');
const adminFinanceHistoriqueController = require('../controllers/admin/adminFinanceHistoriqueController');
const adminElevesAnalyseController = require('../controllers/admin/adminElevesAnalyseController');
const adminClassesSegmentExportController = require('../controllers/admin/adminClassesSegmentExportController');
const { envoyerMailsMobileMoney } = require('../controllers/adminMobileMoneyEmailsController');

// Enseignants Gabkut Schola (modèle Enseignant)
const adminTeachersController = require('../controllers/admin/adminTeachersController');

// Enseignants PUBLIC (modèle Teacher) pour le site public
const adminTeacherController = require('../controllers/adminTeacherController');

const adminAttributionsController = require('../controllers/admin/adminAttributionsController');
const adminNoticesController = require('../controllers/admin/adminNoticesController');

// ➜ middleware upload (multer) pour images/vidéos de communiqués
const uploadNotice = require('../middlewares/noticeUpload');
const uploadTeacher = require('../middlewares/teacherUpload');

// Protection globale
router.use(authMiddleware);
router.use(requireRole(['admin']));

/************************************************************
 📊 STATS & DONNÉES DE BASE
*************************************************************/

// Stats globales
router.get('/stats', adminStatsController.getStats);

// Utilisateurs
router.get('/users', adminUsersController.getUsers);
router.post('/users', adminUsersController.createUser);
router.put('/users/:id', adminUsersController.updateUser);
router.put('/users/:id/status', adminUsersController.updateUserStatus);
router.delete('/users/:id', adminUsersController.deleteUser);

// Classes CRUD
router.get('/classes', adminClassesController.getClasses);
router.get('/classes/:id', adminClassesController.getClasseById);
router.post('/classes', adminClassesController.createClasse);
router.put('/classes/:id', adminClassesController.updateClasse);
router.delete('/classes/:id', adminClassesController.deleteClasse);

/************************************************************
 👨‍🏫 ENSEIGNANTS
*************************************************************/

// 1) Enseignants Gabkut Schola (Enseignant) – RESTE sur /teachers
//    utilisé par ton ancien panneau admin Gabkut
router.get('/teachers', adminTeachersController.getTeachers);
router.get('/teachers/:id', adminTeachersController.getTeacherById);
router.post('/teachers', adminTeachersController.createTeacher);
router.put('/teachers/:id', adminTeachersController.updateTeacher);
router.delete('/teachers/:id', adminTeachersController.deleteTeacher);

// 2) Enseignants PUBLIC (Teacher) – NOUVEAU préfixe /public-teachers
//    utilisé par admin/public-teacher.html
router.get('/public-teachers', adminTeacherController.getTeachers);
router.get('/public-teachers/:id', adminTeacherController.getTeacherById);
router.post('/public-teachers', adminTeacherController.createTeacher);
router.put('/public-teachers/:id', adminTeacherController.updateTeacher);
router.delete('/public-teachers/:id', adminTeacherController.deleteTeacher);

/************************************************************
 📚 ATTRIBUTIONS
*************************************************************/

// Attributions de cours (URL finale: /api/admin/attributions...)
router.get('/attributions', adminAttributionsController.getAttributions);
router.post('/attributions', adminAttributionsController.createAttribution);
router.put('/attributions/:id', adminAttributionsController.updateAttribution);
router.delete('/attributions/:id', adminAttributionsController.deleteAttribution);

/************************************************************
 📚 ÉLÈVES / STUDENTS CRUD
*************************************************************/

// Liste + filtrage
router.get('/students', adminStudentsController.getStudents);
// Détail
router.get('/students/:id', adminStudentsController.getStudentById);
// Création
router.post('/students', adminStudentsController.createStudent);
// Mise à jour
router.put('/students/:id', adminStudentsController.updateStudent);
// Suppression
router.delete('/students/:id', adminStudentsController.deleteStudent);

/************************************************************
 💰 FINANCE & ACTIVITÉS
*************************************************************/

// Finance KPIs
router.get('/finance/kpis', adminFinanceKpisController.getFinanceKpis);

// Historique des paiements
router.get('/finance/historique', adminFinanceHistoriqueController.getHistoriquePaiements);

// Activités
router.get('/activites', adminActivitesController.getActivites);

/************************************************************
 📄 RAPPORTS & EXPORTS ADMIN
*************************************************************/

// Exports finance
router.get('/reports/finance/pdf', adminReportsController.exportFinancePdf);
router.get('/reports/finance/excel', adminReportsController.exportFinanceExcel);

// Résumé dashboard
router.get('/reports/dashboard/summary', adminReportsController.getDashboardSummary);

// Export analyse financière élèves
router.get(
  '/eleves/analyse/export-excel',
  adminElevesAnalyseController.exportAnalyseElevesExcel
);

// Export Excel des classes (segment / filtres appliqués)
router.get(
  '/reports/classes-segment/excel',
  adminClassesSegmentExportController.exportClassesSegmentExcel
);

// Relance parents en retard
router.post('/reports/relance-parents', adminReportsController.relanceParentsEnRetard);
router.post('/paiements/mobile-money/envoyer-mails', envoyerMailsMobileMoney);

/************************************************************
 📢 COMMUNIQUÉS (ADMIN + UPLOAD)
*************************************************************/

// CRUD communiqués (URL finale: /api/admin/notices...)
router.get('/notices', adminNoticesController.getNotices);
router.get('/notices/:id', adminNoticesController.getNoticeById);
router.post('/notices', adminNoticesController.createNotice);
router.put('/notices/:id', adminNoticesController.updateNotice);
router.delete('/notices/:id', adminNoticesController.deleteNotice);

// Upload d'un fichier lié à un communiqué (image ou vidéo)
router.post(
  '/notices/upload',
  uploadNotice.single('file'), // champ "file" dans le form-data
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier reçu.' });
    }

    const relativePath = `/uploads/notices/${req.file.filename}`;

    res.status(201).json({
      message: 'Fichier uploadé avec succès.',
      fileUrl: relativePath,
    });
  }
);

// Upload d'une photo d'enseignant (utilisé pour les deux types si tu veux)
router.post(
  '/teachers/upload',
  uploadTeacher.single('file'), // champ "file" dans le form-data
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier reçu.' });
    }

    const relativePath = `/uploads/teachers/${req.file.filename}`;

    res.status(201).json({
      message: 'Photo uploadée avec succès.',
      fileUrl: relativePath,
    });
  }
);

module.exports = router;

console.log('✅ Routes Admin chargées');
