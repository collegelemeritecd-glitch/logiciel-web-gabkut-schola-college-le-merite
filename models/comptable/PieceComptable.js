const mongoose = require("mongoose");

const pieceComptableSchema = new mongoose.Schema(
  {
    ecriture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EcritureComptable",
      required: true,
    },
    filename: { type: String, required: true },
    originalname: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true }, // chemin sur le disque
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PieceComptable", pieceComptableSchema);
