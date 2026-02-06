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
// 📘 Bilans comptables
router.get("/bilan", comptableController.getBilan);
router.get("/bilan-export-excel", comptableController.exportBilanExcel);

router.get("/compte-resultat-export-with-amortissements", comptableController.exportCompteResultatWithAmortissements);

// Budget annuel (revenus, dépenses, épargne)
router.get("/budget-annuel", comptableController.getBudgetAnnuel);
router.get("/budget-annuel-export-excel", comptableController.exportBudgetAnnuelExcel);

// 📊 Paramètres du budget (dépenses fixes / variables / crédits / épargne)
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

// GET /api/comptable/budget-annuel?annee=2026
router.get("/budget-annuel", budgetAnnuelController.getBudgetAnnuel);
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


module.exports = router;

console.log("✅ Routes Comptable chargées");
