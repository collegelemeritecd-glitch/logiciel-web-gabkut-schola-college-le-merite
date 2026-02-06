// controllers/comptable/budgetAnnuelController.js

const {
  calculerBudgetAnnuel,
} = require("../../services/budgetAnnuelService");

exports.getBudgetAnnuel = async (req, res) => {
  try {
    const annee = parseInt(req.query.annee, 10) || new Date().getFullYear();
    const anneeScolaire = req.query.anneeScolaire || "";

    if (!anneeScolaire) {
      return res
        .status(400)
        .json({ message: "Paramètre 'anneeScolaire' requis." });
    }

    if (!req.user || req.user.role !== "comptable") {
      return res
        .status(403)
        .json({ message: "Accès réservé au comptable." });
    }

    const ecoleId = req.user.ecoleId || null;

    const data = await calculerBudgetAnnuel(annee, anneeScolaire, ecoleId);

    return res.json(data);
  } catch (err) {
    console.error("Erreur getBudgetAnnuel:", err);
    return res.status(500).json({
      message: "Erreur serveur lors du calcul du budget annuel.",
    });
  }
};
