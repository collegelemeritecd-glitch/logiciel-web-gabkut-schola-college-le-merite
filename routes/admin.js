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



// Protection globale
router.use(authMiddleware);
router.use(requireRole(['admin']));

/************************************************************
 📊 STATS & DONNÉES DE BASE
*************************************************************/

// Stats globales
router.get('/stats', adminStatsController.getStats);

// Utilisateurs
// routes/admin.js
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

// Rapport classes
router.get('/classes/report', adminClassesReportController.getClassesReportJson);
router.get('/classes/report/excel', adminClassesReportController.exportClassesReportExcel);

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
// routes/admin.js 
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

module.exports = router;

console.log('✅ Routes Admin chargées');
