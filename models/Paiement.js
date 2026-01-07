/************************************************************
 📘 GABKUT-SCHOLA — MODÈLE PAIEMENT FUSIONNÉ ULTRA 2026
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
*************************************************************/

const mongoose = require('mongoose');

const PaiementSchema = new mongoose.Schema({
  // ========== ÉLÈVE ==========
  eleve: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Eleve',
    required: false,
    index: true
  },
  eleveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Eleve',
    required: false,
    index: true
  },
  eleveNom: {
    type: String,
    required: true,
    trim: true
  },
  eleveMatricule: {
    type: String,
    required: false,
    trim: true
  },
  emailEleve: {
    type: String,
    required: false,
    trim: true,
    lowercase: true
  },
  telephoneEleve: {
    type: String,
    required: false,
    trim: true
  },
  sexeEleve: {
    type: String,
    enum: ['M', 'F'],
    required: false
  },

  // ========== CLASSE ==========
  classe: {
    type: mongoose.Schema.Types.ObjectId,  // ✅ UNIQUEMENT ObjectId
    ref: 'Classe',
    required: false,
    index: true
  },
  classeNom: {
    type: String,  // ✅ NOM de la classe (STRING)
    required: false,
    trim: true
  },
  classeRef: {
    type: mongoose.Schema.Types.ObjectId,  // ✅ Alternative référence
    ref: 'Classe',
    required: false,
    index: true
  },

  // ========== PAIEMENT ==========
  montant: {
    type: Number,
    required: true,
    min: 0
  },
  mois: {
    type: String,
    required: true,
    enum: [
      'Septembre', 'Octobre', 'Novembre', 'Décembre',
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'
    ],
    index: true
  },
  anneeScolaire: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  typePaiement: {
    type: String,
    enum: [
      'fraisAnnuel', 
      'regularisation', 
      'interExercice',
      'detteAnterieure',
      'Inscription', 
      'Mensualité', 
      'Frais divers',
      'normal'
    ],
    default: 'fraisAnnuel'
  },
  anneeConcernee: {
    type: String,
    trim: true,
    required: false,
    default: function() {
      return this.anneeScolaire;
    }
  },
  anneeOrigine: {
    type: String,
    trim: true,
    required: false
  },

  // 💳 MODE DE PAIEMENT
  moyenPaiement: {
    type: String,
    enum: ['Cash', 'Espèces', 'Mobile Money', 'Virement', 'Banque', 'Chèque', 'Autre'],
    default: 'Cash'
  },
  modePaiement: {
    type: String,
    enum: ['Cash', 'Espèces', 'Mobile Money', 'Virement', 'Banque', 'Chèque', 'Autre'],
    default: 'Cash'
  },

  // 🔐 RÉFÉRENCES UNIQUES
  reference: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  referencePaiement: {
    type: String,
    trim: true
  },

  // 📅 DATE ET STATUT
  datePaiement: {
    type: Date,
    default: Date.now,
    index: true
  },
  statut: {
    type: String,
    enum: ['validé', 'annulé', 'en attente', 'À jour', 'Partiel', 'En retard', 'Non payé'],
    default: 'validé',
    index: true
  },

  // 🧠 NOTES ADMINISTRATION
  remarque: {
    type: String,
    trim: true
  },
  noteAdministrative: {
    type: String,
    trim: true
  },
  noteExplicativePdf: {
    type: String,
    trim: true
  },

  // 👤 PERCEPTEUR
  percepteur: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  percepteurNom: {
    type: String,
    required: false,
    trim: true
  },
  percepteurContact: {
    type: String,
    trim: true
  },
  emailPercepteur: {
    type: String,
    trim: true,
    lowercase: true
  },

  // 👨‍👩‍👧 PARENT / TUTEUR
  parentNom: {
    type: String,
    trim: true
  },
  parentContact: {
    type: String,
    trim: true
  },
  emailParent: {
    type: String,
    trim: true,
    lowercase: true
  },
  contactWhatsapp: {
    type: String,
    trim: true
  },
  contactWhatsappParent: {
    type: String,
    trim: true
  },

  // 🏫 ÉCOLE
  ecole: {
    type: String,
    default: 'Collège Le Mérite',
    trim: true
  },

  // 📊 DONNÉES FINANCIÈRES IA-3
  montantMensuel: {
    type: Number,
    required: false
  },
  montantPaye: {
    type: Number,
    required: false
  },
  montantDu: {
    type: Number,
    required: false
  },
  retards: {
    type: Array,
    default: []
  },
  noteIA: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

/* ============================================================
   ⚙️ MIDDLEWARES AUTOMATIQUES
============================================================ */

// 🔑 1. GÉNÉRATION AUTO RÉFÉRENCE UNIQUE
PaiementSchema.pre('save', async function (next) {
  try {
    if (!this.reference) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const h = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.reference = `COLM-GABK-${y}${m}${d}-${h}${min}${s}-${rnd}`;
    }

    // ✅ Synchroniser les références (ObjectId uniquement)
    if (!this.eleveId && this.eleve) {
      this.eleveId = this.eleve;
    }
    
    if (!this.classeRef && this.classe) {
      this.classeRef = this.classe;
    }

    next();
  } catch (err) {
    console.error('❌ Erreur génération référence paiement:', err);
    next(err);
  }
});

// 🔁 2. MISE À JOUR AUTO MONTANT TOTAL PAYÉ ÉLÈVE
PaiementSchema.post('save', async function (doc) {
  try {
    const eleveRef = doc.eleveId || doc.eleve;
    if (eleveRef) {
      const total = await mongoose.model('Paiement').aggregate([
        { 
          $match: { 
            $or: [
              { eleveId: eleveRef }, 
              { eleve: eleveRef }
            ],
            statut: 'validé'
          } 
        },
        { $group: { _id: null, total: { $sum: '$montant' } } }
      ]);
      
      const montantTotal = total[0]?.total || 0;

      const Eleve = mongoose.model('Eleve');
      const eleve = await Eleve.findById(eleveRef).populate('classe');
      
      if (eleve) {
        const fraisTotal = eleve.classe?.montantFrais || 0;
        await Eleve.findByIdAndUpdate(eleveRef, { 
          totalPaye: montantTotal,
          resteAPayer: Math.max(0, fraisTotal - montantTotal)
        });

        console.log(`📌 ${doc.eleveNom} → Total payé: ${montantTotal} USD`);
      }
    }
  } catch (err) {
    console.error('❌ Erreur MAJ montant élève:', err);
  }
});

// 🤖 3. SYNCHRONISATION IA-3 CLASSE
PaiementSchema.post('save', async function (doc) {
  try {
    const classeRef = doc.classeRef || doc.classe;
    if (classeRef && mongoose.Types.ObjectId.isValid(classeRef)) {
      const total = await mongoose.model('Paiement').aggregate([
        { 
          $match: { 
            $or: [
              { classeRef: classeRef },
              { classe: classeRef }
            ],
            statut: 'validé'
          } 
        },
        { $group: { _id: null, total: { $sum: '$montant' } } }
      ]);
      
      const revenusReels = total[0]?.total || 0;

      const Classe = mongoose.model('Classe');
      const classe = await Classe.findById(classeRef);
      
      if (classe) {
        const fraisPrevus = (classe.montantFrais || 0) * (classe.effectif || 0);
        const ecartFinancier = revenusReels - fraisPrevus;
        const tendance = fraisPrevus > 0
          ? ((revenusReels / fraisPrevus) * 100 - 100).toFixed(2)
          : 0;

        await Classe.findByIdAndUpdate(classeRef, {
          revenusReels,
          fraisPrevus,
          ecartFinancier,
          tendance: parseFloat(tendance)
        });

        console.log(`🤖 Classe ${classe.nom} - IA-3: ${revenusReels} USD`);
      }
    }
  } catch (err) {
    console.error('❌ Erreur MAJ IA-3 classe:', err);
  }
});

// 🗑️ 4. NETTOYAGE POST-SUPPRESSION
PaiementSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    console.log(`🗑️ Paiement supprimé: ${doc.reference}`);
    const eleveRef = doc.eleveId || doc.eleve;
    if (eleveRef) {
      const total = await mongoose.model('Paiement').aggregate([
        { $match: { $or: [{ eleveId: eleveRef }, { eleve: eleveRef }], statut: 'validé' } },
        { $group: { _id: null, total: { $sum: '$montant' } } }
      ]);
      
      const montantTotal = total[0]?.total || 0;
      const Eleve = mongoose.model('Eleve');
      const eleve = await Eleve.findById(eleveRef).populate('classe');
      
      if (eleve) {
        const fraisTotal = eleve.classe?.montantFrais || 0;
        await Eleve.findByIdAndUpdate(eleveRef, {
          totalPaye: montantTotal,
          resteAPayer: Math.max(0, fraisTotal - montantTotal)
        });
      }
    }
  }
});

module.exports = mongoose.model('Paiement', PaiementSchema);

console.log('✅ Modèle Paiement FUSIONNÉ ULTRA chargé avec 4 middlewares automatiques');
