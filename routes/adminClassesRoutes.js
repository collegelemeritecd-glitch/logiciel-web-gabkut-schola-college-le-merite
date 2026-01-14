/************************************************************
 📘 ROUTES ADMIN CLASSES - GABKUT SCHOLA
*************************************************************/

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

const adminClassesController = require('../controllers/admin/adminClassesController');

// Protection
router.use(authMiddleware);
router.use(requireRole(['admin']));

// CRUD classes
router.get('/', adminClassesController.getClasses);
router.post('/', adminClassesController.createClasse);
router.put('/:id', adminClassesController.updateClasse);
router.delete('/:id', adminClassesController.deleteClasse);

module.exports = router;
