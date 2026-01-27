// =====================================================================
// 🧾 MODEL – LIGNE DU JOURNAL COMPTABLE (VERSION CORRIGÉE)
// Collège Le Mérite — Gabkut-Schola Comptabilité PRO MAX
// =====================================================================

const mongoose = require("mongoose");

const JournalLineSchema = new mongoose.Schema({

    compteDebit: { type: String, trim: true, default: "" },
    debit: { type: Number, default: 0 },

    compteCredit: { type: String, trim: true, default: "" },
    credit: { type: Number, default: 0 },

    operationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JournalOperation",
        required: true
    },

    ligne: { type: Number, default: 1 },

    date: { type: Date, required: true },

    piece: { type: String, trim: true, default: null },

    libelle: { type: String, trim: true, required: true },

    typeOperation: {
        type: String,
        enum: ["Achat", "Vente", "Encaissement", "Décaissement", "OD", "Stock"],
        default: null
    },

    files: [{
        filename: String,
        path: String,
        mimetype: String,
        size: Number
    }]

}, { timestamps: true });

module.exports = mongoose.model("JournalLine", JournalLineSchema);
