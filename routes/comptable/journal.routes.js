/************************************************************
 📘 ROUTES JOURNAL COMPTABLE - GABKUT SCHOLA
*************************************************************/

const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/requireRole");

const journalController = require("../../controllers/comptable/journal.controller");

router.use(authMiddleware);
router.use(requireRole(["comptable"]));

// CRUD écriture
router.post("/ecritures", journalController.creerEcriture);
router.get("/ecritures", journalController.listerEcritures);
router.get("/ecritures/:id", journalController.getEcriture);
router.put("/ecritures/:id", journalController.mettreAJourEcriture);
router.delete("/ecritures/:id", journalController.supprimerEcriture);

// Autocomplétion comptes
router.get("/comptes/autocomplete", journalController.autocompleteComptes);

// Tableau dashboard
router.get("/ecritures-tableau", journalController.listerEcrituresTableau);

module.exports = router;

console.log("✅ Routes Journal Comptable chargées");
