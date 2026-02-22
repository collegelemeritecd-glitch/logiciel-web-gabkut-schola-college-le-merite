// routes/rhRoutes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/requireRole");


const rhDashboardController = require("../../controllers/rh/rhDashboardController");

// Toutes les routes RH nécessitent un utilisateur connecté RH / admin / comptable
router.use(authMiddleware);
router.use(requireRole(["rh"]));

// GET /api/rh/dashboard-stats
router.get("/rh/dashboard-stats", rhDashboardController.getDashboardStats);

// GET /api/rh/dernieres-paies
router.get("/rh/dernieres-paies", rhDashboardController.getDernieresPaies);
router.use("/rh", require("./parametresPaie.routes"));

// (tu pourras ensuite ajouter ici parametres-paie, salaires, bulletins, etc.)

module.exports = router;
