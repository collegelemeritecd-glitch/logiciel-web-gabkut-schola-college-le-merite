// routes/classesRoutes.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/authMiddleware');

const classesController = require('../controllers/classesController');

// on protège par auth simple (prof/admin, peu importe ici)
router.use(authMiddleware);

router.get('/', classesController.getClasses);

module.exports = router;
