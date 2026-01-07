/************************************************************
 📘 GABKUT SCHOLA - SERVER.JS PRINCIPAL
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
*************************************************************/

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 8080;

// ========== CONNEXION MONGODB ==========
connectDB();

// ========== CORS CONFIGURATION (AVANT TOUS LES MIDDLEWARES) ==========
const allowedOrigins = process.env.FRONTEND_ORIGIN 
  ? process.env.FRONTEND_ORIGIN.split(',') 
  : [
      'http://127.0.0.1:8080',
      'http://localhost:8080',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://127.0.0.1:5501',
      'http://localhost:5501',
      'https://collegelemerite.school'
    ];

app.use(cors({
  origin: function(origin, callback) {
    // Autoriser les requêtes sans origin (Postman, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS bloqué pour: ${origin}`);
      callback(new Error('Non autorisé par CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // ⬅️ AJOUTÉ OPTIONS
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'], // ⬅️ AJOUTÉ
  exposedHeaders: ['Content-Disposition'], // ⬅️ Pour les téléchargements
  preflightContinue: false, // ⬅️ Gérer automatiquement les preflight
  optionsSuccessStatus: 204 // ⬅️ Statut pour OPTIONS (meilleur que 200)
}));

// ========== MIDDLEWARES GLOBAUX ==========
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logs des requêtes en développement
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.path}`);
    next();
  });
}

// Servir les fichiers statiques du frontend
app.use(express.static(path.join(__dirname, '../frontend')));
// 🔓 Servir les fichiers statiques (CSS, rapports, etc.)
app.use(express.static(path.join(__dirname, 'public')));
// => /public/rapports/... devient accessible via /rapports/...

// ========== IMPORTS ROUTES (✅ AVANT UTILISATION) ==========
const authRoutes = require('./routes/auth');
console.log('✅ Auth Controller chargé');
const adminRoutes = require('./routes/admin');
console.log('✅ Routes Admin chargées');
const percepteurRoutes = require('./routes/percepteur');
console.log('✅ Routes Percepteur chargées');
const percepteurElevesRoutes = require('./routes/percepteurEleves'); // ✅ NOUVEAU
console.log('Routes Eleves percepteur chargée');
const configurationRoutes = require('./routes/configuration');
console.log('✅ Routes Configuration chargées');
const rhRoutes = require('./routes/rh');
const comptabiliteRoutes = require('./routes/comptabilite');
const enseignantsRoutes = require('./routes/enseignants');
const elevesRoutes = require('./routes/eleves');
const parentsRoutes = require('./routes/parents');
const analyseRouter = require('./routes/analyse');
const statistiquesRoutes = require('./routes/statistiquesRoutes');
const adminFinanceRoutes = require('./routes/adminFinanceRoutes');

// ✅ NOUVELLES ROUTES PROFIL PERCEPTEUR (User mongoose)
// ⬇️ on récupère UNIQUEMENT la fonction authenticate déjà exportée
const { authenticate } = require('./middlewares/auth');
const percepteurProfilRoutes = require('./routes/percepteurProfilRoutes');
console.log('✅ Routes Profil Percepteur chargées');

// ========== ROUTES API (SÉPARÉES PAR MODULE) ==========
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/percepteur', percepteurRoutes);
app.use('/api/percepteur', percepteurElevesRoutes); // ✅ NOUVEAU
app.use('/api/configuration', configurationRoutes);
app.use('/api/rh', rhRoutes);
app.use('/api/comptabilite', comptabiliteRoutes);
app.use('/api/enseignants', enseignantsRoutes);
app.use('/api/eleves', elevesRoutes);
app.use('/api/parents', parentsRoutes);
app.use('/api/analyse', analyseRouter);
app.use('/api/statistiques', statistiquesRoutes);
app.use('/api/admin', adminFinanceRoutes);

// ✅ Montage des routes profil percepteur protégées par auth
// (on ajoute juste cette ligne, rien d’autre n’est modifié)
app.use('/api/percepteur', authenticate, percepteurProfilRoutes);

// ========== ROUTE SANTÉ ==========
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    message: 'Backend Collège Le Mérite - Gabkut Schola',
    timestamp: new Date().toISOString(),
    anneeScolaire: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
    devise: process.env.DEVISE || 'USD',
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongodb: 'connected'
  });
});

// ========== GESTION ERREURS 404 ==========
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route non trouvée',
    path: req.path,
    method: req.method
  });
});

// ========== MIDDLEWARE ERREURS GLOBALES ==========
app.use(errorHandler);

// ========== DÉMARRAGE SERVEUR ==========
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log('✅ Serveur Collège Le Mérite démarré');
  console.log('📡 Port:', PORT);
  console.log('🌍 URL: http://localhost:' + PORT);
  console.log('📅 Année scolaire:', process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026');
  console.log('💰 Devise:', process.env.DEVISE || 'USD');
  console.log('🔐 CORS Origins:', allowedOrigins.join(', '));
  console.log('⚙️  Environnement:', process.env.NODE_ENV || 'development');
  console.log('🚀 ========================================');
  console.log('');
});

// ========== GESTION ARRÊT PROPRE ==========
process.on('SIGTERM', () => {
  console.log('⚠️  SIGTERM reçu. Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT reçu. Arrêt du serveur...');
  process.exit(0);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});
