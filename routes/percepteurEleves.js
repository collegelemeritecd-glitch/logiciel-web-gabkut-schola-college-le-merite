/************************************************************
 👨‍🎓 PERCEPTEUR ELEVES ROUTES — PRO MAX 2026
 Gabkut Agency LMK - Collège Le Mérite
 Routes dédiées à la gestion des élèves (percepteur/admin)
*************************************************************/

const express = require('express');
const router = express.Router();

const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const Paiement = require('../models/Paiement');

const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// 👉 controller PRO (recherche, dette, exports…)
const percepteurElevesController = require('../controllers/percepteur/percepteurElevesController');

// 🔐 Sécurisation globale
router.use(authMiddleware);
router.use(requireRole('percepteur', 'admin'));

console.log('✅ Routes Percepteur Élèves chargées');

/* ============================================================
 📅 GET /annees-scolaires
============================================================ */
router.get('/annees-scolaires', async (req, res) => {
  try {
    const anneesEleves = await Eleve.distinct('anneeScolaire');
    const anneesPaiements = await Paiement.distinct('anneeScolaire');

    const anneesSet = new Set([...anneesEleves, ...anneesPaiements]);
    let annees = Array.from(anneesSet).filter((a) => a);

    if (annees.length === 0) {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const startYear = currentMonth >= 8 ? currentYear : currentYear - 1;

      annees = [];
      for (let i = 0; i < 3; i++) {
        const year = startYear - i;
        annees.push(`${year}-${year + 1}`);
      }
    }

    annees.sort((a, b) => {
      const yearA = parseInt(a.split('-')[0], 10);
      const yearB = parseInt(b.split('-')[0], 10);
      return yearB - yearA;
    });

    console.log('📅 Années scolaires récupérées:', annees.length);

    res.json({
      success: true,
      annees,
      count: annees.length,
    });
  } catch (error) {
    console.error('❌ Erreur récupération années scolaires:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
});

/* ============================================================
 👨‍🎓 GET /eleves (liste filtrée)
============================================================ */
/// LVES - LISTE FUSIONNÉE AVEC SEXE + AGE + PAIEMENTS + CONTACTS
// LVES - LISTE FUSIONNÉE AVEC SEXE + AGE + PAIEMENTS + CONTACTS
router.get('/eleves', async (req, res) => {
  try {
    const annee =
      req.query.anneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      '2025-2026';

    const filter = { anneeScolaire: annee };
    if (req.query.classeId) {
      filter.classe = req.query.classeId;
    }

    const eleves = await Eleve.find(filter)
      .populate('classe', 'nom niveau montantFrais')
      .lean();

    if (eleves.length === 0) {
      return res.json({
        success: true,
        eleves: [],
        message: 'Aucun élève trouvé pour cette année',
      });
    }

    const eleveIds = eleves.map(e => e._id);

    const paiements = await Paiement.find({
      $or: [
        { eleveId: { $in: eleveIds } },
        { eleve:   { $in: eleveIds } },
      ],
      anneeScolaire: annee,
      statut: { $in: ['valid', 'validé'] },
    }).lean();

    const paiementsParEleve = {};
    paiements.forEach(p => {
      const key = (p.eleveId || p.eleve)?.toString();
      if (!key) return;
      if (!paiementsParEleve[key]) paiementsParEleve[key] = [];
      paiementsParEleve[key].push(p);
    });

    const elevesAvecStats = eleves.map(e => {
      const key = e._id.toString();
      const paiementsEleve = paiementsParEleve[key] || [];

      const totalPaye = paiementsEleve.reduce(
        (sum, p) => sum + (p.montant || 0),
        0
      );
      const montantDu =
        e.montantDu || (e.classe?.montantFrais || 0);
      const solde = Math.max(0, montantDu - totalPaye);
      const taux =
        montantDu > 0 ? (totalPaye / montantDu) * 100 : 0;
      const estAJour = solde <= 0 || taux >= 100;

      let age = e.age;
      if ((age === null || age === undefined) && e.dateNaissance) {
        const naissance = new Date(e.dateNaissance);
        const now = new Date();
        age = now.getFullYear() - naissance.getFullYear();
        const m = now.getMonth() - naissance.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < naissance.getDate())) {
          age--;
        }
      }

      const sexe = e.sexe || e.genre || null;
      const genre = e.genre || e.sexe || null;

      const parentNom =
        e.parentPrincipal?.nom ||
        e.parent?.nom ||
        e.nomParent ||
        '';

      const parentEmail =
        e.parentPrincipal?.email ||
        e.parent?.email ||
        e.emailParent ||
        '';

      const parentTel =
        e.parentPrincipal?.tel ||
        e.parent?.tel ||
        e.telephoneParent ||
        e.parentContact ||
        '';

      const parentWhatsapp =
        e.parentPrincipal?.whatsapp ||
        e.parent?.whatsapp ||
        e.whatsappParent ||
        '';

      const adresseParent =
        e.parentPrincipal?.adresse ||
        e.parent?.adresse ||
        e.adresseParent ||
        '';

      const contactAppel =
        e.contactAppel ||
        e.telephoneParent ||
        e.parentContact ||
        parentTel ||
        '';

      const contactWhatsapp =
        e.contactWhatsapp ||
        e.whatsappEleve ||
        e.whatsappParent ||
        parentWhatsapp ||
        '';

      const classeId =
        (e.classe && e.classe._id)
          ? e.classe._id.toString()
          : (e.classe ? e.classe.toString() : null);

      return {
        id: key,
        _id: key,
        matricule: e.matricule,
        nom: e.nom,
        postnom: e.postnom, // 👈 GABRIEL DOIT ARRIVER ICI
        prenom: e.prenom,
        nomComplet: `${e.nom || ''} ${e.postnom || ''} ${e.prenom || ''}`.trim(),

        sexe,
        genre,
        age: age || null,
        dateNaissance: e.dateNaissance || null,

        adresse: e.adresse || '',
        dateInscription: e.dateInscription || e.createdAt || null,

        emailEleve: e.emailEleve || e.email || '',
        contactEleve: e.contactEleve || '',
        telephoneEleve: e.telephoneEleve || e.contactEleve || '',
        whatsappEleve: e.whatsappEleve || '',
        contactAppel,
        contactWhatsapp,

        classeId,
        classe: e.classe?._id || e.classe,
        classeNom: e.classe?.nom || e.classeNom || '—',
        niveau: e.niveau || e.classe?.niveau || '—',
        anneeScolaire: e.anneeScolaire || annee,

        montantDu,
        montantPaye: e.montantPaye || e.totalPaye || 0,
        totalPaye,
        solde,
        tauxPaiement: taux,
        estAJour,
        statut: e.statut || 'actif',

        moisPayes: e.moisPayes || [],

        photo: e.photo || '',
        photoEleve: e.photoEleve || '',

        parent: e.parent || {},
        parentPrincipal: e.parentPrincipal || {},
        parentNom,
        parentEmail,
        parentTel,
        parentWhatsapp,
        emailParent: e.emailParent || parentEmail,
        telephoneParent: e.telephoneParent || parentTel,
        whatsappParent: e.whatsappParent || parentWhatsapp,
        adresseParent,

        paiements: paiementsEleve,
      };
    });

    return res.json({
      success: true,
      eleves: elevesAvecStats,
    });
  } catch (err) {
    console.error('Erreur GET /percepteur/eleves fusionné', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du chargement des élèves',
      error: err.message,
    });
  }
});


// 📋 DEBUG / CONSULTER UN ÉLÈVE BRUT PAR ID
router.get('/eleves-debug/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 DEBUG élève brut:', id);

    const eleve = await Eleve.findById(id)
      .populate('classe', 'nom niveau montantFrais')
      .lean();

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève non trouvé',
      });
    }

    return res.json({
      success: true,
      eleve,
    });
  } catch (error) {
    console.error('❌ Erreur GET /percepteur/eleves-debug/:id', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
});



/* ============================================================
 👨‍🎓 GET /eleves/:id (fiche simple)
============================================================ */
router.get('/eleves/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const eleve = await Eleve.findById(id)
      .populate('classe', 'nom niveau montantFrais')
      .lean();

    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable',
      });
    }

    const paiements = await Paiement.find({
      $or: [
        { eleveId: id },
        { eleve: id },
      ],
      anneeScolaire: eleve.anneeScolaire,
    }).lean();

    const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);

    const fraisClasse = eleve.classe?.montantFrais || 0;
    const fraisTotal = eleve.montantDu > 0 ? eleve.montantDu : fraisClasse;

    const solde = Math.max(0, fraisTotal - totalPaye);
    const tauxPaiement = fraisTotal > 0 ? (totalPaye / fraisTotal) * 100 : 0;
    const estAJour = solde <= 0 || tauxPaiement >= 100;

    console.log('👨‍🎓 Élève récupéré:', eleve.matricule);

    res.json({
      success: true,
      eleve: {
        ...eleve,
        paiements,
        totalPaye,
        fraisTotal,
        solde,
        tauxPaiement,
        estAJour,
        montantPaye: totalPaye,
        montantDu: fraisTotal,
      },
    });
  } catch (error) {
    console.error('❌ Erreur récupération élève:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
});

// et la route pro dans routes/percepteurEleves.js 
/* ============================================================
 👨‍🎓 POST /eleves
 Créer un nouvel élève (profil complet) + matr. Pro
============================================================ */
router.post('/eleves', async (req, res) => {
  try {
    const {
      nom,
      prenom,
      postnom,
      sexe,
      age,
      dateNaissance,
      classeId,
      anneeScolaire,

      emailEleve,
      contactEleve,
      whatsappEleve,

      nomParent,
      emailParent,
      telephoneParent,
      whatsappParent,

      parent,
      parentPrincipal,
    } = req.body;

    if (!nom || !sexe || !classeId) {
      return res.status(400).json({
        success: false,
        message: 'Nom, sexe et classe sont obligatoires',
      });
    }

    const classe = await Classe.findById(classeId);
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable',
      });
    }

    // Utilisation du helper matriculePro centralisé
    const { genererMatriculePro } = require('../utils/matriculePro');

    const matricule = await genererMatriculePro();
    const montantDu = classe.montantFrais || 0;

    const eleve = new Eleve({
      matricule,
      nom,
      prenom: prenom || '',
      postnom: postnom || '',
      sexe,
      age: age || null,
      dateNaissance: dateNaissance || null,
      classe: classeId,
      anneeScolaire: anneeScolaire || getAnneeScolaireCourante(),

      montantDu,
      montantPaye: 0,

      emailEleve: emailEleve || undefined,
      contactEleve: contactEleve || undefined,
      whatsappEleve: whatsappEleve || undefined,

      nomParent: nomParent || undefined,
      emailParent: emailParent || undefined,
      telephoneParent: telephoneParent || undefined,
      whatsappParent: whatsappParent || undefined,

      parent: parent || {},
      parentPrincipal: parentPrincipal || {},

      dateInscription: new Date(),
    });

    await eleve.save();
    await eleve.populate('classe', 'nom niveau montantFrais');

    console.log('✅ Élève créé:', eleve.matricule, '-', nom);

    res.status(201).json({
      success: true,
      message: 'Élève créé avec succès',
      eleve,
    });
  } catch (error) {
    console.error('❌ Erreur création élève:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
});


/* ============================================================
 👨‍🎓 PUT /eleves/:id
 Modifier / compléter le profil élève (tolérant / diversifié)
============================================================ */
/* ============================================================
 👨‍🎓 PUT /eleves/:id
 Modifier / compléter le profil élève (tolérant / diversifié)
============================================================ */
/* ============================================================
 👨‍🎓 PUT /eleves/:id
 Modifier / compléter le profil élève (tolérant / diversifié)
============================================================ */
/* ============================================================
 👨‍🎓 PUT /eleves/:id
 Modifier / compléter le profil élève
============================================================ */
router.put('/eleves/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      nom,
      prenom,
      postnom,
      sexe,
      age,
      dateNaissance,
      classeId,
      anneeScolaire,

      emailEleve,
      contactEleve,
      whatsappEleve,

      nomParent,
      emailParent,
      telephoneParent,
      whatsappParent,

      parent,
      parentPrincipal,
    } = req.body;

    console.log('📝 PUT /percepteur/eleves/:id payload reçu:', req.body);

    const eleve = await Eleve.findById(id);
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable',
      });
    }

    // Identité
    if (nom !== undefined && nom !== null && nom !== '') eleve.nom = nom;
    if (prenom !== undefined) eleve.prenom = prenom;
    if (postnom !== undefined) eleve.postnom = postnom; // 👈 IMPORTANT
    if (sexe) eleve.sexe = sexe;

    // Age / date
    if (age !== undefined) {
      const parsedAge = Number(age);
      eleve.age = Number.isNaN(parsedAge) ? undefined : parsedAge;
    }

    if (dateNaissance) {
      const d = new Date(dateNaissance);
      if (!isNaN(d.getTime())) eleve.dateNaissance = d;
    }

    if (anneeScolaire) eleve.anneeScolaire = anneeScolaire;

    // Classe
    if (classeId) {
      if (!eleve.classe || eleve.classe.toString() !== String(classeId)) {
        const nouvelleClasse = await Classe.findById(classeId);
        if (nouvelleClasse) {
          eleve.classe = nouvelleClasse._id;
          eleve.montantDu = nouvelleClasse.montantFrais || eleve.montantDu || 0;
        }
      }
    }

    // Contacts élève
    if (emailEleve !== undefined) eleve.emailEleve = emailEleve;
    if (contactEleve !== undefined) eleve.contactEleve = contactEleve;
    if (whatsappEleve !== undefined) eleve.whatsappEleve = whatsappEleve;

    // Parent legacy
    if (nomParent !== undefined) eleve.nomParent = nomParent;
    if (emailParent !== undefined) eleve.emailParent = emailParent;
    if (telephoneParent !== undefined) eleve.telephoneParent = telephoneParent;
    if (whatsappParent !== undefined) eleve.whatsappParent = whatsappParent;

    // Parent objets
    if (parent !== undefined) eleve.parent = parent;
    if (parentPrincipal !== undefined) eleve.parentPrincipal = parentPrincipal;

    await eleve.save();
    await eleve.populate('classe', 'nom niveau montantFrais');

    console.log('✅ Élève modifié / complété:', eleve.matricule);

    res.json({
      success: true,
      message: 'Profil élève mis à jour',
      eleve,
    });
  } catch (error) {
    console.error('❌ Erreur modification élève:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
});





/* ============================================================
 👨‍🎓 DELETE /eleves/:id
============================================================ */
router.delete('/eleves/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const eleve = await Eleve.findById(id);
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable',
      });
    }

    const paiementsSupprimes = await Paiement.deleteMany({
      $or: [
        { eleveId: id },
        { eleve: id },
      ],
    });

    await eleve.deleteOne();

    console.log(
      '🗑️ Élève supprimé:',
      eleve.matricule,
      `(${paiementsSupprimes.deletedCount} paiements)`,
    );

    res.json({
      success: true,
      message: 'Élève et ses paiements supprimés avec succès',
      paiementsSupprimés: paiementsSupprimes.deletedCount,
    });
  } catch (error) {
    console.error('❌ Erreur suppression élève:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
    });
  }
});

/* ============================================================
 🔎 ROUTES PRO DU CONTROLLER (recherche / dette / contacts)
============================================================ */

// recherche avancée (q = texte)
router.get('/eleves-pro/recherche', percepteurElevesController.rechercherEleve);

// fiche complète enrichie par ID
router.get('/eleves-pro/:id', percepteurElevesController.getEleveById);

// dette antérieure N-1
router.get('/eleves-pro/:eleveId/dette-anterieure', percepteurElevesController.getDetteAnterieure);

// mise à jour contacts uniquement
router.put('/eleves-pro/:id/contacts', percepteurElevesController.updateContactsEleve);

// création élève via controller PRO (matricule xxxxx-AAA)
router.post('/eleves-pro', percepteurElevesController.creerEleve);

/* ============================================================
 📤 EXPORTS ÉLÈVES (Excel / PDF / Word)
============================================================ */

router.get(
  '/eleves/export/excel',
  percepteurElevesController.exportElevesExcel,
);

router.get(
  '/eleves/export/pdf',
  percepteurElevesController.exportElevesPdf,
);

router.get(
  '/eleves/export/word',
  percepteurElevesController.exportElevesWord,
);

/* ============================================================
 🛠️ HELPER
============================================================ */
function getAnneeScolaireCourante() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  if (month >= 8) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

module.exports = router;
