/************************************************************
📘 GABKUT SCHOLA - ROUTES API PRINCIPALES (FUSION COMPLÈTE)
Collège Le Mérite - Backend Node.js
Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

// ============================================================
// 🔐 MIDDLEWARES GLOBAUX
// ============================================================
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// ============================================================
// 📦 IMPORT DES ROUTES MODULAIRES
// ============================================================
const authRoutes = require('./auth');
const percepteurRoutes = require('./percepteur');

// Routes modulaires (si elles existent)
let adminRoutes, elevesRoutes, classesRoutes, paiementsRoutes;
let parentsRoutes, enseignantsRoutes, rhRoutes, comptabiliteRoutes;

try {
  adminRoutes = require('./admin');
} catch (e) {
  console.warn('⚠️ Routes admin non trouvées');
}

try {
  elevesRoutes = require('./eleves');
} catch (e) {
  console.warn('⚠️ Routes eleves non trouvées');
}

try {
  classesRoutes = require('./classes');
} catch (e) {
  console.warn('⚠️ Routes classes non trouvées');
}

try {
  paiementsRoutes = require('./paiements');
} catch (e) {
  console.warn('⚠️ Routes paiements non trouvées');
}

try {
  parentsRoutes = require('./parents');
} catch (e) {
  console.warn('⚠️ Routes parents non trouvées');
}

try {
  enseignantsRoutes = require('./enseignants');
} catch (e) {
  console.warn('⚠️ Routes enseignants non trouvées');
}

try {
  rhRoutes = require('./rh');
} catch (e) {
  console.warn('⚠️ Routes rh non trouvées');
}

try {
  comptabiliteRoutes = require('./comptabilite');
} catch (e) {
  console.warn('⚠️ Routes comptabilite non trouvées');
}

// ============================================================
// 📦 CONTROLLERS ADMIN (si pas de routes modulaires)
// ============================================================
let adminStatsController, adminUsersController, adminClassesController;
let adminStudentsController, adminFinanceKpisController, adminActivitesController;

try {
  adminStatsController = require('../controllers/admin/adminStatsController');
  adminUsersController = require('../controllers/admin/adminUsersController');
  adminClassesController = require('../controllers/admin/adminClassesController');
  adminStudentsController = require('../controllers/admin/adminStudentsController');
  adminFinanceKpisController = require('../controllers/admin/adminFinanceKpisController');
  adminActivitesController = require('../controllers/admin/adminActivitesController');
} catch (e) {
  console.warn('⚠️ Controllers admin non trouvés');
}

// ============================================================
// 📦 CONTROLLERS AUTH
// ============================================================
let authController;
try {
  authController = require('../controllers/authController');
} catch (e) {
  console.warn('⚠️ authController non trouvé');
}

// ============================================================
// 🔥 MONTAGE DES ROUTES PRINCIPALES
// ============================================================

// ✅ 1. AUTHENTIFICATION (PUBLIC)
if (authRoutes) {
  router.use('/auth', authRoutes);
  console.log('✅ Routes /auth montées');
} else if (authController) {
  // Fallback si pas de routes modulaires
  router.post('/auth/login', authController.login);
  router.post('/auth/logout', authMiddleware, authController.logout);
  router.get('/auth/verify', authMiddleware, authController.verify);
  console.log('✅ Routes /auth (inline) montées');
}

// ✅ 2. PERCEPTEUR (PROTÉGÉ) - ROUTE CRITIQUE
if (percepteurRoutes) {
  router.use('/percepteur', percepteurRoutes);
  console.log('✅ Routes /percepteur montées (CRITIQUE)');
} else {
  console.error('❌ ERREUR: Routes /percepteur INTROUVABLES');
}

// ✅ 3. ADMIN (PROTÉGÉ)
if (adminRoutes) {
  router.use('/admin', adminRoutes);
  console.log('✅ Routes /admin montées');
} else if (adminStatsController) {
  // Fallback routes inline
  router.get('/admin/stats', authMiddleware, requireRole(['admin']), adminStatsController.getStats);
  router.get('/admin/users', authMiddleware, requireRole(['admin']), adminUsersController.getUsers);
  router.get('/admin/classes', authMiddleware, requireRole(['admin']), adminClassesController.getClasses);
  router.get('/admin/students', authMiddleware, requireRole(['admin']), adminStudentsController.getStudents);
  router.get('/admin/finance/kpis', authMiddleware, requireRole(['admin']), adminFinanceKpisController.getFinanceKpis);
  router.get('/admin/activites', authMiddleware, requireRole(['admin']), adminActivitesController.getActivites);
  console.log('✅ Routes /admin (inline) montées');
}

// ✅ 4. AUTRES ROUTES MODULAIRES (si disponibles)
if (elevesRoutes) {
  router.use('/eleves', elevesRoutes);
  console.log('✅ Routes /eleves montées');
}

if (classesRoutes) {
  router.use('/classes', classesRoutes);
  console.log('✅ Routes /classes montées');
}

if (paiementsRoutes) {
  router.use('/paiements', paiementsRoutes);
  console.log('✅ Routes /paiements montées');
}

if (parentsRoutes) {
  router.use('/parents', parentsRoutes);
  console.log('✅ Routes /parents montées');
}

if (enseignantsRoutes) {
  router.use('/enseignants', enseignantsRoutes);
  console.log('✅ Routes /enseignants montées');
}

if (rhRoutes) {
  router.use('/rh', rhRoutes);
  console.log('✅ Routes /rh montées');
}

if (comptabiliteRoutes) {
  router.use('/comptabilite', comptabiliteRoutes);
  console.log('✅ Routes /comptabilite montées');
}

// ============================================================
// 🧪 ROUTE TEST
// ============================================================
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '✅ API Gabkut Schola opérationnelle (FUSION COMPLÈTE)',
    version: '2.0',
    timestamp: new Date().toISOString(),
    routes: {
      auth: '/api/auth',
      percepteur: '/api/percepteur',
      admin: '/api/admin',
      eleves: '/api/eleves',
      classes: '/api/classes',
      paiements: '/api/paiements'
    }
  });
});

// ============================================================
// ❌ 404 - ROUTE NON TROUVÉE
// ============================================================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `❌ Route ${req.method} ${req.originalUrl} non trouvée`,
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      '/api/test',
      '/api/auth/login',
      '/api/percepteur/dashboard',
      '/api/percepteur/classes',
      '/api/percepteur/paiements',
      '/api/admin/stats'
    ]
  });
});

// ============================================================
// 📤 EXPORT
// ============================================================
module.exports = router;

console.log('🚀 ========================================');
console.log('✅ API Router FUSION COMPLÈTE chargé');
console.log('🚀 ========================================');
