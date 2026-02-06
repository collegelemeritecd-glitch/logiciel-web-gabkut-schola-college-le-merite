// models/ParametresPaie.js
const mongoose = require("mongoose");

const GrilleSalaireSchema = new mongoose.Schema(
  {
    codeCategorie: { type: String, required: true }, // ex: "11", "10C", "9A"
    intitule: { type: String, default: "" },         // optionnel: libellé humain
    montant: { type: Number, required: true },       // salaire catégoriel
  },
  { _id: false }
);

const IndemnitePrimeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },          // ex: "SALAIRE_CAT", "SUR_SALAIRE"
    libelle: { type: String, required: true },       // ex: "Salaire catégoriel"
    nature: {
      type: String,
      enum: ["imposable", "exonere_10_brut", "exonere_total"],
      default: "imposable",
    },
    actif: { type: Boolean, default: true },
  },
  { _id: false }
);

const ParametresPaieSchema = new mongoose.Schema(
  {
    // Période de paie
    mois: { type: Number, min: 1, max: 12, required: true },     // 1=janvier
    annee: { type: Number, required: true },                     // ex: 2026
    datePaie: { type: Date, required: true },                    // date effective de paie
    actif: { type: Boolean, default: true },                     // période active

    // Identification entreprise (reprend LOGIPAIE)
    denomination: { type: String, default: "" },
    formeJuridique: { type: String, default: "" },
    sigle: { type: String, default: "" },
    activite: { type: String, default: "" },
    adresse: { type: String, default: "" },
    boitePostale: { type: String, default: "" },
    telephone: { type: String, default: "" },
    commune: { type: String, default: "" },
    quartier: { type: String, default: "" },
    rue: { type: String, default: "" },
    lot: { type: String, default: "" },
    centreImpots: { type: String, default: "" },
    numeroCompteContribuable: { type: String, default: "" },
    numeroCNSS: { type: String, default: "" },
    codeEtablissement: { type: String, default: "" },
    codeActivite: { type: String, default: "" },
    registreCommerce: { type: String, default: "" },
    numeroCompteBancaire: { type: String, default: "" },

    // Taux fiscaux et sociaux (LOGIPAIE: ITS, CN, CNPS, FDFP, etc.)
    tauxITS: { type: Number, default: 0 },           // ex: 1.2
    tauxCN: { type: Number, default: 0 },            // contribution nationale, si tu l’utilises

    tauxCNPSRetraiteSalarie: { type: Number, default: 0 },   // 6.3
    tauxCNPSRetraiteEmployeur: { type: Number, default: 0 }, // 7.7

    tauxAccidentTravail: { type: Number, default: 0 },       // AT 3
    tauxPrestationsFamiliales: { type: Number, default: 0 }, // PF 5.75

    tauxFDFPTaxeApprentissage: { type: Number, default: 0 }, // TA 0.4
    tauxFDFPFormationContinue: { type: Number, default: 0 }, // FPC 0.6

    // Grille des salaires (catégories / montants)
    grilleSalaires: [GrilleSalaireSchema],

    // Indemnités et primes paramétrables
    indemnitesPrimes: [IndemnitePrimeSchema],

    // Autres paramètres (prime transport, ancienneté, arrondi)
    montantExonerePrimeTransport: { type: Number, default: 0 }, // ex: 25000
    primeAncienneteActive: { type: Boolean, default: true },
    netAPayerArrondi: { type: Number, default: 1 },             // ex: 500

    // Représentant entreprise
    nomRepresentant: { type: String, default: "" },
    qualiteRepresentant: { type: String, default: "" },         // ex: "LE GERANT"

    // Métadonnées
    creePar: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: true,
  }
);

// Index pour retrouver rapidement la période active
ParametresPaieSchema.index({ annee: 1, mois: 1 }, { unique: true });

module.exports = mongoose.model("ParametresPaie", ParametresPaieSchema);
