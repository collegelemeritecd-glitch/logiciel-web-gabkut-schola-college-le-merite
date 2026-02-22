/************************************************************
 📘 ROUTES COMPTABLE - GABKUT SCHOLA
*************************************************************/

const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/requireRole");

const comptableController = require("../../controllers/comptable/comptableController");
const comptableBudgetController = require("../../controllers/comptable/comptableBudgetController");
const budgetAnnuelController = require("../../controllers/comptable/budgetAnnuelController");
const comptesController = require("../../controllers/comptable/comptesController");

// Protection globale
router.use(authMiddleware);
router.use(requireRole(["comptable"]));

/**
 * 📊 DASHBOARD & STATS (journal multi-lignes)
 * URL: /api/comptable/dashboard-stats
 */
router.get("/dashboard-stats", comptableController.getDashboardStats);

// 📁 Export Excel dashboard
router.get(
  "/dashboard-export-excel",
  comptableController.exportDashboardExcel
);

// 📘 Grand livre
router.get("/grand-livre", comptableController.getGrandLivre);
router.get(
  "/grand-livre-export-excel",
  comptableController.exportGrandLivreExcel
);

// 📗 Balance générale (tous les comptes)
router.get("/balance", comptableController.getBalanceGenerale);
router.get(
  "/balance-export-excel",
  comptableController.exportBalanceGeneraleExcel
);

// 📙 Compte de résultat (charges / produits 6 et 7)
router.get(
  "/compte-resultat",
  comptableController.getCompteResultatChargesProduits
);
router.get(
  "/compte-resultat-export-excel",
  comptableController.exportCompteResultatChargesProduitsExcel
);

// 📘 Bilans comptables (ouverture / en cours / clôture)
router.get("/bilan", comptableController.getBilan);
router.get("/bilan-export-excel", comptableController.exportBilanExcel);

router.get(
  "/compte-resultat-export-with-amortissements",
  comptableController.exportCompteResultatWithAmortissements
);

// 🔵 Budget annuel (revenus, dépenses, épargne, trésorerie)
router.get("/budget-annuel", budgetAnnuelController.getBudgetAnnuel);
router.get(
  "/budget-annuel-export-excel",
  comptableController.exportBudgetAnnuelExcel
);

// 📊 Paramètres du budget
router.get(
  "/budget-parametres",
  comptableBudgetController.getBudgetParametres
);

router.post(
  "/budget-parametres",
  comptableBudgetController.saveBudgetParametres
);

router.get(
  "/budget-mensuel",
  comptableBudgetController.getBudgetMensuel
);

// Créances élèves (clients)
router.get("/creances-eleves", comptableController.getCreancesEleves);
router.get(
  "/creances-eleves-export-excel",
  comptableController.exportCreancesElevesExcel
);

// 📚 Classes (liste simple pour filtres comptables)
router.get(
  "/classes/liste-simples",
  comptableController.getClassesSimples
);

// Dettes tiers
router.get("/dettes-tiers", comptableController.getDettesTiers);
router.get(
  "/dettes-tiers-export-excel",
  comptableController.exportDettesTiersExcel
);

// Trésorerie détaillée (caisse 571, banques 52x, virements 58)
router.get(
  "/tresorerie-detaillee",
  comptableController.getTresorerieDetaillee
);
router.get(
  "/tresorerie-detaillee-export-excel",
  comptableController.exportTresorerieDetailleeExcel
);

// 📒 Plan comptable – liste paginée des comptes
router.get("/comptes", comptesController.listerComptes);

// 📒 Détail d'un compte
router.get("/comptes/:id", comptesController.getCompte);

// 📒 Création / mise à jour d'un compte
router.post("/comptes", comptesController.creerCompte);
router.put("/comptes/:id", comptesController.mettreAJourCompte);

// 📚 Plan comptable (lecture seule) reconstruit depuis la collection comptes
router.get("/plan-comptable-from-db", async (req, res) => {
  try {
    const Compte = require("../../models/comptable/Compte"); // adapte le chemin si besoin

    // On récupère tous les comptes (tu peux filtrer/sort si nécessaire)
    const comptes = await Compte.find({}, { numero: 1, intitule: 1, _id: 0 })
      .sort({ numero: 1 })
      .lean();

    // Structure: { "1": { classe: "1", rubriques: [...] }, ..., "7": {...} }
    const plan = {};

    for (const c of comptes) {
      if (!c.numero) continue;
      const numero = String(c.numero);
      const classeKey = numero.charAt(0);    // "6"
      const rubriqueKey = numero.substring(0, 2); // "60"

      if (!plan[classeKey]) {
        plan[classeKey] = {
          classe: classeKey,
          numero: classeKey,
          intitule: "", // tu peux compléter si tu as les libellés de classes ailleurs
          rubriques: []
        };
      }

      const classeObj = plan[classeKey];

      let rub = classeObj.rubriques.find((r) => r.numero === rubriqueKey);
      if (!rub) {
        rub = {
          numero: rubriqueKey,
          intitule: "", // idem, à compléter si tu as les intitulés de rubriques
          comptes: []
        };
        classeObj.rubriques.push(rub);
      }

      // On pousse le compte tel qu'il est en base
      rub.comptes.push({
        numero: numero,
        intitule: c.intitule || ""
      });
    }

    // On renvoie un tableau de classes 1..7
    const classesArray = Object.values(plan).sort((a, b) =>
      a.classe.localeCompare(b.classe)
    );

    return res.json({
      success: true,
      data: classesArray
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la reconstruction du plan comptable depuis la base."
    });
  }
});

module.exports = router;

console.log("✅ Routes Comptable chargées");
