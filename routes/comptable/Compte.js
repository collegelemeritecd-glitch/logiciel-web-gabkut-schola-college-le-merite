// ======================================================================
// 📘 MODEL — Compte Individuel (Utilisé dans le Journal)
// Collège Le Mérite — Gabkut-Schola PRO MAX 2038
// ======================================================================

const mongoose = require("mongoose");

const CompteSchema = new mongoose.Schema(
{
    // Code du compte (ex : 4111, 512, 701…)
    numero: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },

    // Libellé court du compte (ex : Clients, Banque, Caisse…)
    intitule: {
        type: String,
        required: true,
        trim: true,
    },

    // Solde cumulé via les opérations
    soldeDebit: { type: Number, default: 0 },
    soldeCredit: { type: Number, default: 0 },

    // Calcul automatique du solde final
    soldeFinal: { type: Number, default: 0 },

    // Dernière opération affectant ce compte
    derniereOperation: { type: Date, default: null },
},
{
    timestamps: true,
}
);

// ======================================================================
// 🧮 MIDDLEWARE — Calcul automatique du solde final
// ======================================================================
CompteSchema.pre("save", function (next) {
    this.soldeFinal = this.soldeDebit - this.soldeCredit;
    next();
});

// ======================================================================
// EXPORT
// ======================================================================
module.exports =
    mongoose.models.Compte || mongoose.model("Compte", CompteSchema);
