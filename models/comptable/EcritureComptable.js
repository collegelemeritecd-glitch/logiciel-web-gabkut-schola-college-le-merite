// ======================================================================
// 📘 MODEL — Ecriture Comptable (Journal Général)
// Collège Le Mérite — Gabkut-Schola PRO MAX 2038
// ======================================================================
const mongoose = require("mongoose");
const Compte = require("./Compte");

// ---------- LIGNE D'ÉCRITURE ----------
const LigneEcritureSchema = new mongoose.Schema(
  {
    compteNumero: {
      type: String,
      required: true,
      trim: true,
    },
    compteIntitule: {
      type: String,
      trim: true,
    },
    sens: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: true,
    },
    montant: {
      type: Number,
      required: true,
      min: 0,
    },
    libelleLigne: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

// ---------- PIÈCE JUSTIFICATIVE ----------
const PieceSchema = new mongoose.Schema(
  {
    filename: String,   // nom visible
    path: String,       // chemin disque/S3
    mimetype: String,
    size: Number,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// ---------- ÉCRITURE COMPTABLE ----------
const EcritureComptableSchema = new mongoose.Schema(
  {
    typeOperation: {
      type: String,
      enum: [
        "Achat",
        "Vente",
        "Amortissement",
        "Encaissement",
        "Décaissement",
        "OD",
        "Stock",
        ""
      ],
      default: "",
      trim: true,
    },

    // Date comptable réelle (date de l'opération)
    dateOperation: {
      type: Date,
      required: true,
    },

    // 🔹 Date technique pour le reporting / filtres (peut être = now)
    dateReporting: {
      type: Date,
      default: null,
      index: true,
    },

    libelle: {
      type: String,
      required: true,
      trim: true,
    },

    reference: {
      type: String,
      unique: true,
      trim: true,
    },

    lignes: {
      type: [LigneEcritureSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length >= 2;
        },
        message: "Une écriture doit contenir au moins 2 lignes.",
      },
    },

    totalDebit: { type: Number, default: 0 },
    totalCredit: { type: Number, default: 0 },

    pieces: [PieceSchema],

    creePar: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// ---------- MIDDLEWARE: contrôle équilibre + totaux ----------
EcritureComptableSchema.pre("validate", function (next) {
  let debit = 0;
  let credit = 0;

  (this.lignes || []).forEach((l) => {
    if (l.sens === "DEBIT") debit += l.montant;
    if (l.sens === "CREDIT") credit += l.montant;
  });

  this.totalDebit = debit;
  this.totalCredit = credit;

  if (Math.abs(debit - credit) > 0.0001) {
    return next(
      new Error("Écriture non équilibrée : total Débit doit égaler total Crédit.")
    );
  }

  // Si aucune dateReporting n'est fournie, on peut (optionnel) la mettre à maintenant
  if (!this.dateReporting) {
    this.dateReporting = new Date();
  }

  next();
});

// ---------- MIDDLEWARE: maj soldes de Compte ----------
EcritureComptableSchema.post("save", async function (doc, next) {
  try {
    const operationsParCompte = {};

    doc.lignes.forEach((l) => {
      if (!operationsParCompte[l.compteNumero]) {
        operationsParCompte[l.compteNumero] = { debit: 0, credit: 0 };
      }
      if (l.sens === "DEBIT") operationsParCompte[l.compteNumero].debit += l.montant;
      if (l.sens === "CREDIT") operationsParCompte[l.compteNumero].credit += l.montant;
    });

    const numeros = Object.keys(operationsParCompte);
    const comptes = await Compte.find({ numero: { $in: numeros } });

    for (const compte of comptes) {
      const ops = operationsParCompte[compte.numero];
      compte.soldeDebit += ops.debit;
      compte.soldeCredit += ops.credit;
      compte.derniereOperation = new Date();
      await compte.save();
    }

    next();
  } catch (err) {
    console.error("Erreur mise à jour soldes comptes:", err);
    next(err);
  }
});

// ---------- EXPORT ----------
module.exports =
  mongoose.models.EcritureComptable ||
  mongoose.model("EcritureComptable", EcritureComptableSchema);
