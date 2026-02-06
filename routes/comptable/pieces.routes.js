// routes/comptable/pieces.routes.js

const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/requireRole");

const uploadPieces = require("../../middlewares/uploadPieces");
const piecesController = require("../../controllers/comptable/pieces.controller");

router.use(authMiddleware);
router.use(requireRole(["comptable"]));

// upload multiples pièces pour une écriture
// POST /api/comptable/pieces/:ecritureId
router.post(
  "/pieces/:ecritureId",
  uploadPieces,
  piecesController.uploadPieces
);

// téléchargement d'une pièce
// GET /api/comptable/pieces/:pieceId/download
router.get("/pieces/:pieceId/download", piecesController.telechargerPiece);

// suppression d'une pièce
// DELETE /api/comptable/pieces/:pieceId
router.delete("/pieces/:pieceId", piecesController.supprimerPiece);

module.exports = router;
