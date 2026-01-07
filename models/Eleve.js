/************************************************************
 📘 GABKUT-SCHOLA — MODÈLE ÉLÈVE FUSIONNÉ PRO MAX 2026
 Collège Le Mérite - Backend Node.js
 Gabkut Agency LMK +243822783500
 
 ✅ Identité complète
 ✅ Connexion élève (email + password)
 ✅ Reset password OTP
 ✅ Parent principal + sous-document parent
 ✅ Scolarité (montant dû, payé, mois)
 ✅ TOUS LES CONTACTS (élève + parent)
*************************************************************/

const mongoose = require('mongoose');

/* ------------------------------------------------------------
   👨‍👩‍👦 Sous-document Parent
------------------------------------------------------------ */
const ParentSchema = new mongoose.Schema({
  nom: { type: String, trim: true },
  tel: { type: String, trim: true },
  whatsapp: { type: String, trim: true },
  email: { type: String, trim: true }, // ✅ EMAIL PARENT ICI
  adresse: { type: String, trim: true },
  role: { type: String, trim: true }, // Père / Mère / Tuteur
}, { _id: false });

/* ------------------------------------------------------------
   👨‍🎓 SCHÉMA ÉLÈVE FUSIONNÉ
------------------------------------------------------------ */
const EleveSchema = new mongoose.Schema({
  /* ------------------------------
     🆔 Identité de l'élève
  ------------------------------ */
  matricule: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    index: true,
  },

  nom: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  prenom: {
    type: String,
    required: true,
    trim: true
  },

  sexe: {
    type: String,
    enum: ['M', 'F'],
    required: true
  },

  age: { type: Number },

  dateNaissance: {
    type: Date
  },

  /* ------------------------------
     💻 Connexion élève
  ------------------------------ */
  emailEleve: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },

  passwordHash: { type: String },

  /* 🔥 Reset password OTP */
  resetOtp: { type: Number },
  resetOtpExpire: { type: Number },

  /* ------------------------------
     📞 Contacts ÉLÈVE
  ------------------------------ */
  contactEleve: { type: String, trim: true },
  telephoneEleve: { type: String, trim: true }, // ✅ ALIAS
  whatsappEleve: { type: String, trim: true },

  /* ------------------------------
     🏫 Classe + Année scolaire
  ------------------------------ */
  classe: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Classe',
    required: true,
    index: true
  },

  anneeScolaire: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  /* ------------------------------
     💵 Scolarité
  ------------------------------ */
  montantDu: { type: Number, default: 0 },
  montantPaye: { type: Number, default: 0 },
  moisPayes: { type: [String], default: [] },

  /* ------------------------------
     📸 Photo élève
  ------------------------------ */
  photo: { type: String },
  photoEleve: { type: String, default: '' },

  /* ------------------------------
     👨‍👩‍👦 Informations Parent (sous-document)
  ------------------------------ */
  parent: { type: ParentSchema, default: {} },

  /* ------------------------------
     👨‍👩‍👦 Parent principal (référence User)
  ------------------------------ */
  parentPrincipal: {
    nom: { type: String, trim: true },
    tel: { type: String, trim: true },
    email: { type: String, trim: true }, // ✅ EMAIL PARENT PRINCIPAL
    sexe: { type: String, trim: true },
    profession: { type: String, trim: true },
    adresse: { type: String, trim: true },
    whatsapp: { type: String, trim: true } // ✅ WHATSAPP PARENT
  },

  /* ------------------------------
     📞 CONTACTS PARENT DIRECTS (LEGACY - pour compatibilité)
  ------------------------------ */
  nomParent: { type: String, trim: true },
  emailParent: { type: String, trim: true }, // ✅ EMAIL PARENT DIRECT
  telephoneParent: { type: String, trim: true }, // ✅ TEL PARENT DIRECT
  whatsappParent: { type: String, trim: true }, // ✅ WHATSAPP PARENT DIRECT

  /* ------------------------------
     📊 Statut
  ------------------------------ */
  statut: {
    type: String,
    enum: ['actif', 'inactif', 'suspendu'],
    default: 'actif',
    index: true
  },

  /* ------------------------------
     🗓 Métadonnées
  ------------------------------ */
  dateInscription: { type: Date, default: Date.now }
}, {
  timestamps: true
});

/* ------------------------------------------------------------
   🎯 Pre-save : Calcul du montant dû automatiquement
------------------------------------------------------------ */
EleveSchema.pre('save', async function (next) {
  try {
    if (this.isNew && this.classe) {
      const Classe = mongoose.model('Classe');
      const classeInfo = await Classe.findById(this.classe).lean();
      if (classeInfo) {
        this.montantDu = classeInfo.montantFrais || 0;
      }
    }
    next();
  } catch (err) {
    console.error('⚠️ Erreur pre-save Eleve :', err);
    next(err);
  }
});

/* ------------------------------------------------------------
   ⚡ Indexation stratégique
------------------------------------------------------------ */
EleveSchema.index({ nom: 1 });
EleveSchema.index({ anneeScolaire: 1 });
EleveSchema.index({ 'parent.tel': 1 });
EleveSchema.index({ 'parent.email': 1 }); // ✅ INDEX EMAIL PARENT
EleveSchema.index({ 'parent.whatsapp': 1 });
EleveSchema.index({ emailParent: 1 }); // ✅ INDEX EMAIL PARENT DIRECT

module.exports = mongoose.model('Eleve', EleveSchema);
