/* ============================================================================
 🔗 GABKUT-ÉCOLE — LIENS SÉCURISÉS DE PARTAGE (PRO MAX 2026)
------------------------------------------------------------------------------
 Génère un lien sécurisé pour le partage d'un document :
 - Token unique encrypté
 - Expiration automatique
 - Stockage MongoDB
 - Compatible WhatsApp / Email / SMS
============================================================================= */

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const Document = require("../models/Document");
const Share = require("../models/Share"); // modèle auto-créé si inexistant
const express = require("express");

/* ============================================================================
 🔒 Modèle interne de lien sécurisé (si inexistant)
============================================================================= */
if (!fs.existsSync(path.join(__dirname, "..", "models", "Share.js"))) {
  const mongoose = require("mongoose");
  const ShareSchema = new mongoose.Schema(
    {
      documentId: { type: String, required: true },
      token: { type: String, unique: true, required: true },
      expiresAt: { type: Date, required: true },
      used: { type: Boolean, default: false },
    },
    { timestamps: true }
  );
  module.exports.Share = mongoose.model("Share", ShareSchema);
}

/* ============================================================================
 🎯 Génération d'un lien sécurisé
============================================================================= */
async function generateShareLink(documentId, duration = "24h") {
  const expiresAt = computeExpiration(duration);
  const token = crypto.randomBytes(32).toString("hex");

  await Share.create({
    documentId,
    token,
    expiresAt,
  });

  return `${process.env.FRONTEND_URL || "http://localhost:8080"}/share/${token}`;
}

/* ============================================================================
 🧮 Convertit la durée de type "24h", "30m", "7d" en horodatage
============================================================================= */
function computeExpiration(duration) {
  const now = new Date();
  const amount = parseInt(duration);
  if (duration.includes("m")) now.setMinutes(now.getMinutes() + amount);
  else if (duration.includes("h")) now.setHours(now.getHours() + amount);
  else if (duration.includes("d")) now.setDate(now.getDate() + amount);
  else now.setDate(now.getDate() + 1);
  return now;
}

/* ============================================================================
 🚀 Route Express (prévisualisation / téléchargement sécurisé via token)
  👉 À monter dans server.js (juste une fois)
============================================================================= */
const router = express.Router();

router.get("/share/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const share = await Share.findOne({ token });

    if (!share) return res.status(404).send("Lien inexistant");
    if (share.used) return res.status(410).send("Lien déjà utilisé");
    if (new Date() > share.expiresAt) return res.status(410).send("Lien expiré");

    const doc = await Document.findById(share.documentId);
    if (!doc) return res.status(404).send("Document introuvable");

    // Option : le lien n'est utilisable qu'une seule fois
    share.used = true;
    await share.save();

    res.download(doc.path);
  } catch (err) {
    console.error(err);
    res.status(500).send("Erreur de lien sécurisé");
  }
});

module.exports = generateShareLink;
module.exports.router = router;
