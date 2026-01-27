/************************************************************
 📘 GABKUT SCHOLA - SERVER.JS PRINCIPAL
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const connectDB = require("./config/db");
const errorHandler = require("./middlewares/errorHandler");

const app = express();
const PORT = process.env.PORT || 8080;

// ========== CONNEXION MONGODB ==========
connectDB();

// ========== CORS CONFIGURATION ==========
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(",").map((o) => o.trim())
  : [
      "http://127.0.0.1:8080",
      "http://localhost:8080",
      "https://collegelemerite.school",
    ];

console.log("🔐 Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      console.log(`❌ CORS bloqué pour: ${origin}`);
      return callback(new Error("Non autorisé par CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Disposition"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

// Preflight
app.options("*", cors());

// ========== MIDDLEWARES GLOBAUX ==========
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

if (process.env.NODE_ENV === "development") {
  app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
  });
}

// Statique frontend & public
app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.static(path.join(__dirname, "public")));

// ========== IMPORTS ROUTES ==========
const authRoutes = require("./routes/auth");
console.log("✅ Auth Controller chargé");
const adminRoutes = require("./routes/admin");
console.log("✅ Routes Admin chargées");
const percepteurRoutes = require("./routes/percepteur");
console.log("✅ Routes Percepteur chargées");
const percepteurElevesRoutes = require("./routes/percepteurEleves");
console.log("Routes Eleves percepteur chargée");
const configurationRoutes = require("./routes/configuration");
console.log("✅ Routes Configuration chargées");
const rhRoutes = require("./routes/rh");
const comptabiliteRoutes = require("./routes/comptabilite");
const enseignantsRoutes = require("./routes/enseignants");
const elevesRoutes = require("./routes/eleves");
const parentsRoutes = require("./routes/parents");
const analyseRouter = require("./routes/analyse");
const statistiquesRoutes = require("./routes/statistiquesRoutes");
const adminFinanceRoutes = require("./routes/adminFinanceRoutes");
const exportFicheEleveRoutes = require("./routes/exportFicheEleve");
const percepteurRapportClassesRoutes = require("./routes/percepteurRapportClasses");
const percepteurRoutesv2 = require("./routes/percepteurRoutesV2");
const publicRoutes = require("./routes/publicRoutes");
const maxicashRoutes = require("./routes/maxicashRoutes");
const publicMaxicashConfig = require("./routes/publicMaxicashConfig");
const publicPaiementsRoutes = require("./routes/publicPaiementsRoutes");
const debugRoutes = require("./routes/debugRoutes");

// Comptable
const comptableRoutes = require("./routes/comptable/comptableRoutes");
const journalRoutes = require("./routes/comptable/journal.routes");
const piecesComptableRoutes = require("./routes/comptable/pieces.routes");
const immobilisationsRoutes = require('./routes/comptable/immobilisations.routes');

// ✅ NOUVELLES ROUTES PROFIL PERCEPTEUR (User mongoose)
const { authenticate } = require("./middlewares/auth");
const percepteurProfilRoutes = require("./routes/percepteurProfilRoutes");
console.log("✅ Routes Profil Percepteur chargées");

// ========== ROUTES API ==========

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/percepteur", percepteurRoutes);
app.use("/api/percepteur", percepteurElevesRoutes);
app.use("/api/configuration", configurationRoutes);
app.use("/api/rh", rhRoutes);
app.use("/api/comptabilite", comptabiliteRoutes);
app.use("/api/enseignants", enseignantsRoutes);
app.use("/api/eleves", elevesRoutes);
app.use("/api/parents", parentsRoutes);
app.use("/api/analyse", analyseRouter);
app.use("/api/statistiques", statistiquesRoutes);
app.use("/api/admin", adminFinanceRoutes);
app.use("/api/export-fiche", exportFicheEleveRoutes);
app.use("/api/percepteur/rapport-classes", percepteurRapportClassesRoutes);
app.use("/api/percepteur", percepteurRoutesv2);
app.use("/api/public", publicRoutes);
app.use("/api/public", publicMaxicashConfig);
app.use("/api/public/paiements", publicPaiementsRoutes);
app.use("/api/debug", debugRoutes);

// 💡 Nouveau journal comptable (EcritureComptable) D'ABORD
app.use("/api/comptable", journalRoutes);
app.use("/api/comptable", piecesComptableRoutes);
app.use('/api/comptable/immobilisations', immobilisationsRoutes);
// Anciennes routes comptables (dashboard, etc.) ENSUITE
app.use("/api/comptable", comptableRoutes);

// ✅ Routes MaxiCash
app.use("/api/maxicash", maxicashRoutes);

// ✅ Routes profil percepteur protégées
app.use("/api/percepteur", authenticate, percepteurProfilRoutes);

// ========== ROUTE SANTÉ ==========
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    message: "Backend Collège Le Mérite - Gabkut Schola",
    timestamp: new Date().toISOString(),
    anneeScolaire: process.env.ANNEE_SCOLAIRE_DEFAUT || "2025-2026",
    devise: process.env.DEVISE || "USD",
    port: PORT,
    nodeEnv: process.env.NODE_ENV || "development",
    mongodb: "connected",
  });
});

// ========== ROUTE RACINE ==========
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Bienvenue sur le backend Gabkut Schola - Collège Le Mérite",
    timestamp: new Date().toISOString(),
    apiDocumentation: "/api/health",
  });
});

// ========== GESTION ERREURS 404 ==========
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Route non trouvée",
    path: req.path,
    method: req.method,
  });
});

// ========== MIDDLEWARE ERREURS GLOBALES ==========
app.use(errorHandler);

// ========== DÉMARRAGE SERVEUR ==========
const server = app.listen(PORT, () => {
  console.log("");
  console.log("🚀 ========================================");
  console.log("✅ Serveur Collège Le Mérite démarré");
  console.log("📡 Port:", PORT);
  console.log("🌍 URL: http://localhost:" + PORT);
  console.log("NODE_ENV =", process.env.NODE_ENV);
  console.log("🔐 CORS Origins:", allowedOrigins.join(", "));
  console.log(
    "📅 Année scolaire:",
    process.env.ANNEE_SCOLAIRE_DEFAUT || "2025-2026"
  );
  console.log("💰 Devise:", process.env.DEVISE || "USD");
  console.log("⚙️  Environnement:", process.env.NODE_ENV || "development");
  console.log("🚀 ========================================");
  console.log("");
});

// ➜ exporter app pour les scripts de debug
module.exports = app;

// ========== GESTION ARRÊT PROPRE ==========
process.on("SIGTERM", () => {
  console.log("⚠️  SIGTERM reçu. Arrêt du serveur...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n⚠️  SIGINT reçu. Arrêt du serveur...");
  process.exit(0);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
});
