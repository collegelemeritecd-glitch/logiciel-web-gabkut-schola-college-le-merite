// routes/rhRoutes.js
const express = require("express");
const router = express.Router();

const rhDashboardController = require("../controllers/rh/rhDashboardController");

// Middlewares d'auth (à adapter à ton projet)
const { authMiddleware, requireRole } = require("../middlewares/authMiddleware");

// Toutes les routes RH nécessitent un utilisateur connecté RH / admin / comptable
router.use(authMiddleware);
router.use(requireRole(["rh", "admin", "comptable"]));

// GET /api/rh/dashboard-stats
router.get("/rh/dashboard-stats", rhDashboardController.getDashboardStats);

// GET /api/rh/dernieres-paies
router.get("/rh/dernieres-paies", rhDashboardController.getDernieresPaies);

// (tu pourras ensuite ajouter ici parametres-paie, salaires, bulletins, etc.)

module.exports = router;
