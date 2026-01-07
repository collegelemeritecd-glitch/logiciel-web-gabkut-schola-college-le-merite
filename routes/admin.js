/************************************************************
 📘 ROUTES ADMIN - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// Controllers
const adminStatsController = require('../controllers/admin/adminStatsController');
const adminUsersController = require('../controllers/admin/adminUsersController');
const adminClassesController = require('../controllers/admin/adminClassesController');
const adminStudentsController = require('../controllers/admin/adminStudentsController');
const adminFinanceKpisController = require('../controllers/admin/adminFinanceKpisController');
const adminActivitesController = require('../controllers/admin/adminActivitesController');

// Middleware pour toutes les routes admin
router.use(authMiddleware);
router.use(requireRole(['admin']));

// Stats globales
router.get('/stats', adminStatsController.getStats);

// Utilisateurs
router.get('/users', adminUsersController.getUsers);

// Classes
router.get('/classes', adminClassesController.getClasses);

// Élèves/Students
router.get('/students', adminStudentsController.getStudents);

// Finance KPIs
router.get('/finance/kpis', adminFinanceKpisController.getFinanceKpis);

// Activités
router.get('/activites', adminActivitesController.getActivites);

module.exports = router;

console.log('✅ Routes Admin chargées');
