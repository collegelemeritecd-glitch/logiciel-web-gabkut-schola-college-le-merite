const mongoose = require("mongoose");

const PaieMensuelleSchema = new mongoose.Schema(
  {
    // Référence salarié
    salarie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salarie",
      required: true,
    },

    // Redondance utile pour les listes (évite un populate lourd)
    nomComplet: { type: String, required: true },
    matricule: { type: String, required: true },
    service: { type: String },
    fonction: { type: String },

    // Période de paie
    mois: { type: Number, required: true }, // 1-12
    annee: { type: Number, required: true },
    datePaie: { type: Date, required: true },

    // Éléments fixes
    salaireBase: { type: Number, default: 0 },
    surSalaire: { type: Number, default: 0 },
    primeTransport: { type: Number, default: 0 },
    primeAnciennete: { type: Number, default: 0 },

    // Variables du mois
    joursTravailles: { type: Number, default: 0 },
    heuresSup: { type: Number, default: 0 },
    autresPrimes: { type: Number, default: 0 }, // primes diverses, gratifications
    congePaye: { type: Number, default: 0 }, // montant congé payé du mois
    gratification: { type: Number, default: 0 },

    // Brut, retenues, net
    brut: { type: Number, default: 0 }, // salaire brut du mois

    retenueCNSS: { type: Number, default: 0 },
    retenueINPP: { type: Number, default: 0 },
    retenueONEM: { type: Number, default: 0 },
    retenueIPR: { type: Number, default: 0 },
    autresRetenues: { type: Number, default: 0 }, // avances, prêts, etc.

    netAPayer: { type: Number, default: 0 },

    // Charges patronales
    cnssEmployeur: { type: Number, default: 0 },
    inppEmployeur: { type: Number, default: 0 },
    onemEmployeur: { type: Number, default: 0 },
    autresChargesEmployeur: { type: Number, default: 0 },

    // Somme pour le dashboard (chargesPatronales = total)
    chargesPatronales: { type: Number, default: 0 },

    // Suivi congés (pour ce mois)
    congesAcquis: { type: Number, default: 0 },
    congesPris: { type: Number, default: 0 },
    congesRestants: { type: Number, default: 0 },

    statut: {
      type: String,
      enum: ["actif", "sorti"],
      default: "actif",
    },

    // Métadonnées éventuelles (référence de bulletin, etc.)
    referenceBulletin: { type: String },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("PaieMensuelle", PaieMensuelleSchema);
