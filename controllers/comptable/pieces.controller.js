const fs = require("fs");
const path = require("path");
const PieceComptable = require("../../models/comptable/PieceComptable");
const EcritureComptable = require("../../models/comptable/EcritureComptable");

/**
 * POST /api/comptable/pieces/:ecritureId
 * Body: multipart/form-data, champ "pieces" (multiple)
 */
exports.uploadPieces = async (req, res) => {
  try {
    const ecritureId = req.params.ecritureId;

    const ecriture = await EcritureComptable.findById(ecritureId);
    if (!ecriture) {
      // nettoyage des fichiers uploadés si écriture inexistante
      (req.files || []).forEach((f) => {
        if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
      return res
        .status(404)
        .json({ success: false, message: "Écriture introuvable." });
    }

    if (!req.files || !req.files.length) {
      return res
        .status(400)
        .json({ success: false, message: "Aucune pièce reçue." });
    }

    const userId = req.user ? req.user._id : null;

    const docs = await PieceComptable.insertMany(
      req.files.map((f) => ({
        ecriture: ecriture._id,
        filename: f.filename,
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        path: f.path,
        uploadedBy: userId,
      }))
    );

    return res.status(201).json({
      success: true,
      message: "Pièces enregistrées avec succès.",
      data: docs,
    });
  } catch (err) {
    console.error("Erreur upload pièces:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l'upload des pièces.",
    });
  }
};

/**
 * GET /api/comptable/pieces/:pieceId/download
 */
exports.telechargerPiece = async (req, res) => {
  try {
    const piece = await PieceComptable.findById(req.params.pieceId).lean();
    if (!piece) {
      return res
        .status(404)
        .json({ success: false, message: "Pièce introuvable." });
    }

    if (!piece.path || !fs.existsSync(piece.path)) {
      return res
        .status(404)
        .json({ success: false, message: "Fichier non trouvé sur le serveur." });
    }

    res.setHeader("Content-Type", piece.mimetype);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(piece.originalname)}"`
    );
    const stream = fs.createReadStream(piece.path);
    stream.pipe(res);
  } catch (err) {
    console.error("Erreur téléchargement pièce:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors du téléchargement.",
    });
  }
};

/**
 * DELETE /api/comptable/pieces/:pieceId
 */
exports.supprimerPiece = async (req, res) => {
  try {
    const piece = await PieceComptable.findById(req.params.pieceId);
    if (!piece) {
      return res
        .status(404)
        .json({ success: false, message: "Pièce introuvable." });
    }

    try {
      if (piece.path && fs.existsSync(piece.path)) {
        fs.unlinkSync(piece.path);
      }
    } catch (err) {
      console.error("Erreur suppression fichier pièce:", err);
    }

    await PieceComptable.findByIdAndDelete(piece._id);

    return res.json({
      success: true,
      message: "Pièce supprimée avec succès.",
    });
  } catch (err) {
    console.error("Erreur suppression pièce:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la suppression de la pièce.",
    });
  }
};
