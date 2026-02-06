const mongoose = require("mongoose");

const SalarieSchema = new mongoose.Schema(
  {
    matricule: { type: String, required: true, unique: true },
    nomComplet: { type: String, required: true }, // Nom + prénoms
    sexe: { type: String, enum: ["M", "F"], default: "M" },

    dateNaissance: { type: Date },
    adresse: { type: String },
    telephone: { type: String },

    service: { type: String }, // Département / service
    fonction: { type: String }, // Poste occupé
    categorie: { type: String }, // Catégorie/grille salariale

    dateEntree: { type: Date, required: true },
    dateSortie: { type: Date, default: null },

    salaireCategoriel: { type: Number, default: 0 }, // salaire de base
    surSalaire: { type: Number, default: 0 }, // complément éventuel

    partsIPR: { type: Number, default: 0 }, // parts pour l’IPR
    numeroCNSS: { type: String }, // n° immatriculation CNSS
    modePaiement: {
      type: String,
      enum: ["virement", "especes", "cheque"],
      default: "virement",
    },

    // Suivi congés (en jours) - cumulé
    congesAcquis: { type: Number, default: 0 },
    congesPris: { type: Number, default: 0 },
    congesRestants: { type: Number, default: 0 },

    // Statut RH
    statut: {
      type: String,
      enum: ["actif", "sorti", "suspendu"],
      default: "actif",
    },

    // Lien éventuel avec un compte utilisateur
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Salarie", SalarieSchema);
