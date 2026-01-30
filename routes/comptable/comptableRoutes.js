/************************************************************
 📘 ROUTES COMPTABLE - GABKUT SCHOLA
*************************************************************/

const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/authMiddleware");
const requireRole = require("../../middlewares/requireRole");

const comptableController = require("../../controllers/comptable/comptableController");
const comptableBudgetController = require("../../controllers/comptable/comptableBudgetController");

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

module.exports = router;

console.log("✅ Routes Comptable chargées");
