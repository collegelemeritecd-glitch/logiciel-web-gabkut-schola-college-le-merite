/************************************************************
 📘 MODÈLE LOG ACTIVITÉ FUSIONNÉ ULTRA - GABKUT SCHOLA
 Collège Le Mérite
 Gabkut Agency LMK +243822783500
 
 ✅ Fusion complète de 3 versions
 ✅ Tous les champs de toutes les versions
 ✅ Compatibilité maximale
 ✅ Tous les champs optionnels pour éviter les erreurs
*************************************************************/

const mongoose = require('mongoose');

const logActiviteSchema = new mongoose.Schema({
  // ========== AUTEUR (ULTRA-FLEXIBLE) ==========
  auteur: {
    type: mongoose.Schema.Types.Mixed,  // String OU ObjectId
    required: false
  },
  auteurNom: {
    type: String,
    required: false
  },
  roleAuteur: {
    type: String,
    enum: [
      'admin', 
      'percepteur', 
      'rh', 
      'comptable', 
      'teacher', 
      'enseignant',
      'student', 
      'eleve',
      'parent', 
      'tuteur',
      'system'
    ],
    default: 'system'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },

  // ========== TYPE D'ACTIVITÉ (UNION TOTALE) ==========
  type: {
    type: String,
    required: false,
    enum: [
      // Originaux
      'connexion',
      'deconnexion',
      'creation',
      'modification',
      'suppression',
      'paiement',
      'validation',
      'rejet',
      'email',
      'export',
      'import',
      'consultation',
      // Ajouts
      'authentification',
      'eleve',
      'classe',
      'utilisateur',
      'autre'
    ],
    index: true
  },

  // ========== NATURE (UNION TOTALE) ==========
  nature: {
    type: String,
    required: false,
    enum: [
      // Minuscules (Schema1)
      'utilisateur',
      'eleve',
      'enseignant',
      'parent',
      'classe',
      'paiement',
      'frais',
      'note',
      'presence',
      'conge',
      'paie',
      'rapport',
      'parametre',
      'email',
      'document',
      'modification',
      'suppression',
      'creation',
      'autre',
      // Capitalisées (Schema2)
      'Connexion',
      'Déconnexion',
      'Création paiement',
      'Modification paiement',
      'Suppression paiement',
      'Création élève',
      'Modification élève',
      'Suppression élève',
      'Création classe',
      'Modification classe',
      'Suppression classe',
      'Création utilisateur',
      'Modification utilisateur',
      'Suppression utilisateur',
      'Modification',
      'Création',
      'Suppression',
      'Autre'
    ]
  },

  // ========== DÉTAILS ==========
  details: {
    type: String,
    required: false
  },

  // ========== CIBLE / ENTITÉ (DOUBLE SUPPORT) ==========
  cible: {
    type: mongoose.Schema.Types.ObjectId,
    required: false
  },
  cibleType: {
    type: String,
    required: false
  },
  entiteId: {
    type: String,
    required: false
  },
  entiteType: {
    type: String,
    required: false
  },

  // ========== DONNÉES TRAÇABILITÉ ==========
  anciennesDonnees: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  nouvellesDonnees: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  metadata: {
    type: Object,
    required: false
  },

  // ========== CONTEXTE TECHNIQUE ==========
  ip: {
    type: String,
    required: false
  },
  userAgent: {
    type: String,
    required: false
  },

  // ========== ANNÉE SCOLAIRE ==========
  anneeScolaire: {
    type: String,
    required: false,
    index: true
  },

  // ========== STATUT ==========
  statut: {
    type: String,
    enum: ['success', 'error', 'warning'],
    default: 'success'
  },
  erreur: {
    type: String,
    required: false
  }
}, {
  timestamps: true
});

// ========== INDEX OPTIMISÉS ==========
logActiviteSchema.index({ type: 1, createdAt: -1 });
logActiviteSchema.index({ nature: 1, createdAt: -1 });
logActiviteSchema.index({ auteur: 1, createdAt: -1 });
logActiviteSchema.index({ userId: 1, createdAt: -1 });
logActiviteSchema.index({ anneeScolaire: 1, createdAt: -1 });
logActiviteSchema.index({ createdAt: -1 });

// ========== MÉTHODE STATIQUE ULTRA-FLEXIBLE ==========
logActiviteSchema.statics.creerLog = async function(data) {
  try {
    // ✅ Auto-mapping auteur → userId
    if (data.auteur && mongoose.Types.ObjectId.isValid(data.auteur) && !data.userId) {
      data.userId = data.auteur;
    }

    // ✅ Auto-mapping entiteId → cible
    if (data.entiteId && !data.cible) {
      if (mongoose.Types.ObjectId.isValid(data.entiteId)) {
        data.cible = data.entiteId;
      }
    }

    // ✅ Auto-mapping entiteType → cibleType
    if (data.entiteType && !data.cibleType) {
      data.cibleType = data.entiteType;
    }

    // ✅ Normaliser nature (minuscule si simple)
    if (data.nature && !data.nature.includes(' ') && data.nature[0] === data.nature[0].toUpperCase()) {
      // Si c'est un mot simple capitalisé, on le garde tel quel
    }

    const log = await this.create(data);
    console.log(`📋 Log créé: ${data.type || 'N/A'} - ${data.nature || 'N/A'} - ${data.details || 'N/A'}`);
    return log;
  } catch (error) {
    console.error('❌ Erreur création log:', error.message);
    // Ne pas throw pour ne pas bloquer l'application
    return null;
  }
};

// ========== MÉTHODE D'INSTANCE POUR DEBUG ==========
logActiviteSchema.methods.toString = function() {
  return `[${this.type}] ${this.nature} par ${this.auteurNom || this.auteur} : ${this.details}`;
};

const LogActivite = mongoose.model('LogActivite', logActiviteSchema);

module.exports = LogActivite;

console.log('✅ Modèle LogActivite FUSIONNÉ ULTRA chargé - Tous champs optionnels');
