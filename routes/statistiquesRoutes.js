// =============================================================
// 📊 GABKUT-ÉCOLE — ROUTES STATISTIQUES (VERSION PRO MAX 2026)
// =============================================================
const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statistiquesController");

// =============================================================
// 🧱 MIDDLEWARE ANTI-CACHE (important pour dashboard en temps réel)
// =============================================================
function noCache(_req, res, next) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
}

// =============================================================
// 🔹 ROUTES STATISTIQUES PRINCIPALES
// =============================================================
// Ces routes sont recalculées à chaque appel
router.get("/globales", noCache, statsController.getStatsGlobales);
router.get("/par-mois", noCache, statsController.getStatsParMois);
router.get("/par-classe", noCache, statsController.getStatsParClasse);
router.get("/par-classe/:id", noCache, statsController.getStatsParClasseUnique);
router.get("/evolution", noCache, statsController.getEvolutionMensuelle);

// 🔥 Nouvelle compatibilité pour dashboard Chart.js
router.get("/mensuelles", noCache, statsController.rapportMensuel);  // ⬅ correction du 404

// PDF depuis tableau
router.post("/export-pdf", noCache, statsController.exportRapportPDF);

// =============================================================
// 🔹 ROUTES FILTRÉES DYNAMIQUES
// =============================================================
router.get("/filtrer", noCache, statsController.filtrerToutesConditions);
router.get("/filtre/annee-mois", noCache, statsController.filtrerParAnneeMois);
router.get("/filtre/classe-cycle", noCache, statsController.filtrerParClasseCycle);
router.get("/filtre/periode", noCache, statsController.filtrerParPeriode);
router.get("/filtre/avance", noCache, statsController.filtrerAvance);

// =============================================================
// 📅 RAPPORTS FINANCIERS — Journalier → Annuel
// =============================================================
// Chaque rapport renvoie PDF + Excel + data pour dashboard
router.get("/rapport/journalier", noCache, statsController.rapportJournalier);
router.get("/rapport/hebdomadaire", noCache, statsController.rapportHebdomadaire);
router.get("/rapport/mensuel", noCache, statsController.rapportMensuel);
router.get("/rapport/trimestriel", noCache, statsController.rapportTrimestriel);
router.get("/rapport/semestriel", noCache, statsController.rapportSemestriel);
router.get("/rapport/annuel", noCache, statsController.rapportAnnuel);

// Synchronisation automatique après recalcul DB
router.get("/recalculer-effectifs", noCache, statsController.recalculerEffectifs);

// =============================================================
// 🧩 ROUTE UNIVERSELLE DE RECYCLAGE DES STATISTIQUES
// =============================================================
// Appelée automatiquement depuis la création d’un paiement
router.post("/recalculer", async (req, res) => {
  try {
    await statsController.recalculerStatistiques();
    res.json({ message: "✅ Statistiques recalculées avec succès." });
  } catch (err) {
    console.error("Erreur recalcul :", err);
    res.status(500).json({ message: "❌ Échec du recalcul des statistiques." });
  }
});

module.exports = router;
console.log("📌 routes/statistiques.js chargé ✔");
