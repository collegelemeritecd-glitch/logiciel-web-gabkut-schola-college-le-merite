/************************************************************
 📘 ROUTES AUTH - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Login
router.post('/login', authController.login);

// Logout
router.post('/logout', authMiddleware, authController.logout);

// ✅ AJOUTE CETTE ROUTE VERIFY
router.get('/verify', authMiddleware, authController.verify);

module.exports = router;

console.log('✅ Routes Auth chargées');
