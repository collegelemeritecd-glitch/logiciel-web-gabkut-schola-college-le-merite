// routes/rh/parametresPaie.routes.js
const express = require("express");
const router = express.Router();

const {
  getParametres,
  upsertParametres,
} = require("../../controllers/rh/parametresPaieController");

// Récupérer les paramètres de paie (lecture simple)
router.get(
  "/parametres",
  getParametres
);

// Créer / mettre à jour les paramètres de paie
router.put(
  "/parametres",
  upsertParametres
);

module.exports = router;
