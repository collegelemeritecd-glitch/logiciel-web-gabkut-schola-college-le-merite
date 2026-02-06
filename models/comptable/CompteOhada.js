// ======================================================================
// 📘 MODEL — Compte OHADA (SYSCOHADA) — PRO MAX 2038
// Collège Le Mérite — Gabkut-Schola
// ======================================================================

const mongoose = require("mongoose");

// -----------------------------------------------------------
// 📌 Sous-niveau : comptes d’une rubrique
// Exemple : 4111 Clients, 4112 Clients Groupe, etc.
// -----------------------------------------------------------
const SousCompteSchema = new mongoose.Schema({
    numero: {
        type: String,
        required: true,
    },
    intitule: {
        type: String,
        required: true,
        trim: true,
    },
}, { _id: false });

// -----------------------------------------------------------
// 📌 Rubriques d’un compte principal (niveau 2)
// Exemple : 41 → Clients et comptes rattachés
// Rubriques : 411, 412, 413…
// -----------------------------------------------------------
const RubriqueSchema = new mongoose.Schema({
    numero: {
        type: String,
        required: true,
    },
    intitule: {
        type: String,
        required: true,
        trim: true,
    },
    comptes: [SousCompteSchema]   // LISTE DES SOUS-COMPTES
}, { _id: false });

// -----------------------------------------------------------
// 📌 Compte OHADA principal (classe 1, 2, 3, 4, 5, 6, 7, 8 ou 9)
// Exemple : 41 Clients, 52 Banque, 60 Achats, etc.
// -----------------------------------------------------------
const CompteOhadaSchema = new mongoose.Schema(
{
    // Exemples : "1", "11", "41", "512", etc.
    numero: {
        type: String,
        required: true,
        unique: true,
    },

    // Intitulé général
    intitule: {
        type: String,
        required: true,
        trim: true,
    },

    // Niveaux internes OHADA
    // classe → rubrique(s) → sous-comptes
    rubriques: [RubriqueSchema],
},
{
    timestamps: true,
}
);

module.exports =
    mongoose.models.CompteOhada ||
    mongoose.model("CompteOhada", CompteOhadaSchema);
