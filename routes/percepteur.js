// ROUTES PERCEPTEUR - GABKUT SCHOLA FUSION COMPLÈTE
// Collège Le Mérite - Gabkut Agency LMK +243822783500

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

// MIDDLEWARES
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// CONTROLLERS
const percepteurDashboardController = require('../controllers/percepteur/percepteurDashboardController');
const percepteurElevesController = require('../controllers/percepteur/percepteurElevesController');
const percepteurPaiementsController = require('../controllers/percepteur/percepteurPaiementsController');
const percepteurClassesController = require('../controllers/percepteur/percepteurClassesController');
const percepteurJournalController = require('../controllers/percepteur/percepteurJournalController');
const percepteurEmailsController = require('../controllers/percepteur/percepteurEmailsController');
const percepteurRapportClassesController = require('../controllers/percepteur/percepteurRapportClassesController'); // ⬅️

// MODELS
const Paiement = require('../models/Paiement');
const Eleve = require('../models/Eleve');
const Classe = require('../models/Classe');
const mongoose = require('mongoose');

// ============================================================
// ROUTES DEBUG SANS AUTH
// ============================================================

// Derniers paiements (debug)
router.get('/paiements-debug', async (req, res) => {
  try {
    const paiements = await Paiement.find()
      .sort({ datePaiement: -1 })
      .limit(10)
      .select('_id eleveNom montant datePaiement mois')
      .lean();

    res.json({
      success: true,
      count: paiements.length,
      message: paiements.length === 0 ? 'Aucun paiement en base !' : `${paiements.length} paiements trouvés`,
      paiements: paiements.map(p => ({
        id: p._id,
        eleve: p.eleveNom || 'Nom manquant',
        montant: p.montant,
        mois: p.mois,
        date: p.datePaiement,
        url: `http://127.0.0.1:8080/recu.html?id=${p._id}`
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Création d’un paiement de test (debug)
router.all('/paiements-test', async (req, res) => {
  try {
    const paiementTest = new Paiement({
      eleveId: new mongoose.Types.ObjectId(),
      eleveNom: 'Test Élève',
      elevePrenom: 'Junior',
      eleveMatricule: 'TEST-2026-001',
      emailEleve: 'test.eleve@test.com',
      telephoneEleve: '+243999999999',
      whatsappEleve: '+243999999999',
      parentNom: 'Parent Test',
      emailParent: 'parent.test@test.com',
      telephoneParent: '+243888888888',
      whatsappParent: '+243888888888',
      percepteurId: new mongoose.Types.ObjectId(),
      percepteurNom: 'Percepteur Test',
      percepteurEmail: 'percepteur.test@test.com',
      percepteurTel: '+243777777777',
      percepteurWhatsapp: '+243777777777',
      montant: 100,
      mois: 'Janvier',
      moyenPaiement: 'Cash',
      anneeConcernee: '2025-2026',
      classeNom: 'Test Classe',
      noteAdministrative: 'Paiement de test généré automatiquement',
      datePaiement: new Date()
    });

    await paiementTest.save();

    res.json({
      success: true,
      message: 'Paiement de test créé',
      paiement: paiementTest,
      url: `http://127.0.0.1:8080/recu.html?id=${paiementTest._id}`

    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// MIDDLEWARE GLOBAL PERCEPTEUR (APRÈS ROUTES DEBUG)
// ============================================================
router.use(authMiddleware);
router.use(requireRole('percepteur', 'admin'));

// ============================================================
// DASHBOARD
// ============================================================

router.get('/dashboard', percepteurDashboardController.getDashboard);

// ============================================================
// STATISTIQUES
// ============================================================

// Stats du jour
router.get('/statistiques/today', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const paiementsToday = await Paiement.find({
      percepteurId: req.user._id,
      datePaiement: { $gte: today, $lt: tomorrow }
    });

    const totalAujourdhui = paiementsToday.reduce((sum, p) => sum + (p.montant || 0), 0);
    const nombrePaiements = paiementsToday.length;
    const moyennePaiement = nombrePaiements > 0 ? totalAujourdhui / nombrePaiements : 0;

    res.json({
      totalAujourdhui,
      nombrePaiements,
      moyennePaiement,
      paiements: paiementsToday
    });
  } catch (error) {
    console.error('Erreur stats today:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stats globales
router.get('/statistiques', async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const currentYear = anneeScolaire || (process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026');

    console.log('📊 Chargement statistiques percepteur:', currentYear);

    const filtre = {
      anneeScolaire: currentYear,
      statut: 'valid'
    };

    // Si besoin, filtrer par percepteur en prod (à activer plus tard si nécessaire)
    // if (req.user.role !== 'admin') {
    //   filtre.percepteurId = req.user._id;
    // }

    const now = new Date();

    const debutJour = new Date(now);
    debutJour.setHours(0, 0, 0, 0);
    const finJour = new Date(now);
    finJour.setHours(23, 59, 59, 999);

    const debutSemaine = new Date(now);
    const jour = debutSemaine.getDay();
    const diff = debutSemaine.getDate() - (jour === 0 ? 6 : jour - 1);
    debutSemaine.setDate(diff);
    debutSemaine.setHours(0, 0, 0, 0);

    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      statsAujourdhui,
      statsSemaine,
      statsMois,
      statsAnnee,
      repartitionModes,
      topClasses
    ] = await Promise.all([
      Paiement.aggregate([
        { $match: { ...filtre, datePaiement: { $gte: debutJour, $lte: finJour } } },
        { $group: { _id: null, total: { $sum: '$montant' }, count: { $sum: 1 } } }
      ]),
      Paiement.aggregate([
        { $match: { ...filtre, datePaiement: { $gte: debutSemaine } } },
        { $group: { _id: null, total: { $sum: '$montant' }, count: { $sum: 1 } } }
      ]),
      Paiement.aggregate([
        { $match: { ...filtre, datePaiement: { $gte: debutMois } } },
        { $group: { _id: null, total: { $sum: '$montant' }, count: { $sum: 1 } } }
      ]),
      Paiement.aggregate([
        { $match: filtre },
        {
          $group: {
            _id: null,
            total: { $sum: '$montant' },
            count: { $sum: 1 },
            moyenne: { $avg: '$montant' }
          }
        }
      ]),
      Paiement.aggregate([
        { $match: filtre },
        { $group: { _id: '$modePaiement', total: { $sum: '$montant' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } }
      ]),
      Paiement.aggregate([
        { $match: filtre },
        { $group: { _id: '$classeNom', total: { $sum: '$montant' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 5 }
      ])
    ]);

    const elevesStats = await Eleve.aggregate([
      { $match: { anneeScolaire: currentYear, isActive: true } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          aJour: { $sum: { $cond: [{ $lte: ['$resteAPayer', 0] }, 1, 0] } },
          enRetard: { $sum: { $cond: [{ $gt: ['$resteAPayer', 0] }, 1, 0] } }
        }
      }
    ]);

    const classesActives = await Paiement.distinct('classeNom', filtre);

    const classeDominante = topClasses.length > 0 ? topClasses[0]._id : null;

    console.log('TOP CLASSES', topClasses);
    console.log('Classe dominante', classeDominante);

    const response = {
      revenuTotal: statsAnnee[0]?.total || 0,
      totalPaiements: statsAnnee[0]?.count || 0,
      moyennePaiement: statsAnnee[0]?.moyenne || 0,
      medianePaiement: statsAnnee[0]?.moyenne || 0, // simplifié
      paiementsAujourdhui: statsAujourdhui[0]?.count || 0,
      revenuAujourdhui: statsAujourdhui[0]?.total || 0,
      paiementsSemaine: statsSemaine[0]?.count || 0,
      revenuSemaine: statsSemaine[0]?.total || 0,
      paiementsMois: statsMois[0]?.count || 0,
      revenuMois: statsMois[0]?.total || 0,
      classesActives: classesActives.length,
      classeDominante,
      topClasses,
      elevesPayeurs: elevesStats[0]?.aJour || 0,
      elevesEnRetard: elevesStats[0]?.enRetard || 0,
      modeDominant: repartitionModes[0]?._id || 'Cash',
      repartitionModes,
      trendRevenu: 0,
      predictionSemaine: (statsAnnee[0]?.moyenne || 0) * 7,
      predictionMois: (statsAnnee[0]?.moyenne || 0) * 30,
      evolutionJournaliere: null
    };

    console.log('Stats envoyées avec classeDominante:', response.classeDominante);

    res.json(response);
  } catch (error) {
    console.error('Erreur statistiques:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des statistiques',
      error: error.message
    });
  }
});

// Comparaison annuelle
router.get('/comparaison-annuelle', async (req, res) => {
  try {
    const { anneeScolaire } = req.query;
    const currentYear = anneeScolaire || (process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026');

    const [debut, fin] = currentYear.split('-').map(Number);
    const anneePrecedente = `${debut - 1}-${fin - 1}`;

    const [statsActuelle, statsPrecedente] = await Promise.all([
      Paiement.aggregate([
        { $match: { anneeScolaire: currentYear, statut: 'valid' } },
        { $group: { _id: null, total: { $sum: '$montant' }, count: { $sum: 1 } } }
      ]),
      Paiement.aggregate([
        { $match: { anneeScolaire: anneePrecedente, statut: 'valid' } },
        { $group: { _id: null, total: { $sum: '$montant' }, count: { $sum: 1 } } }
      ])
    ]);

    const anneeActuelle = statsActuelle[0]?.total || 0;
    const anneePrecedenteTotal = statsPrecedente[0]?.total || 0;

    res.json({
      anneeActuelleLabel: currentYear,
      anneePrecedenteLabel: anneePrecedente,
      anneeActuelle,
      anneePrecedente: anneePrecedenteTotal,
      evolution: anneeActuelle - anneePrecedenteTotal,
      pourcentage:
        anneePrecedenteTotal === 0
          ? 0
          : (((anneeActuelle - anneePrecedenteTotal) / anneePrecedenteTotal) * 100).toFixed(2)
    });
  } catch (error) {
    console.error('Erreur comparaison:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la comparaison annuelle',
      error: error.message
    });
  }
});

// ============================================================
// ÉLÈVES
// ============================================================

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






// Recherche d’élèves
router.get('/eleves/recherche', percepteurElevesController.rechercherEleve);

// Élèves fréquents
router.get('/eleves/frequents', async (req, res) => {
  try {
    const eleves = await Eleve.find()
      .populate('classe')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const elevesAvecStats = await Promise.all(
      eleves.map(async (eleve) => {
        const paiements = await Paiement.find({
          eleveId: eleve._id,
          anneeConcernee: '2025-2026'
        });

        const totalPaye = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
        const fraisTotal = eleve.classe?.montantFrais || 0;
        const resteAPayer = fraisTotal - totalPaye;

        return {
          ...eleve,
          totalPaye,
          resteAPayer
        };
      })
    );

    res.json(elevesAvecStats);
  } catch (error) {
    console.error('Erreur élèves fréquents:', error);
    res.status(500).json({ error: error.message });
  }
});

// Détail dette antérieure
router.get('/eleves/:eleveId/dette-anterieure', percepteurElevesController.getDetteAnterieure);


// Détail élève
router.get('/eleves/:id', percepteurElevesController.getEleveById);

// Mise à jour contacts élève
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


// J'ai trouvé router.post('/eleves', percepteurElevesController.creerEleve); dans routes/percepteur.js, la grande routes, l'ancienne.
// Création d'un élève (percepteur) 
router.post('/eleves', percepteurElevesController.creerEleve);


// ============================================================
// CLASSES
// ============================================================

// Liste classes actives

// ============================================================
// RAPPORT CLASSES (⬅️ AVANT /classes pour éviter conflit)
// ============================================================
router.get('/rapport-classes/export-excel', percepteurRapportClassesController.exportExcel);
router.get('/rapport-classes/export-pdf', percepteurRapportClassesController.exportPDF);
// Route obsolète - téléchargement direct maintenant
// router.get('/rapport-classes/download/:filename', percepteurRapportClassesController.downloadFile);

router.get('/rapport-classes', percepteurRapportClassesController.getRapportClasses);



// ============================================================
// CLASSES (routes génériques)
// ============================================================

// Liste classes actives
router.get('/classes', async (req, res) => {

  try {
    console.log('📚 GET /percepteur/classes - Récupération liste classes');
    const classes = await Classe.find({ isActive: true })
      .select('nom niveau montantFrais effectif')
      .sort({ nom: 1 })
      .lean();

    console.log(`${classes.length} classes actives trouvées`);

    res.json({
      success: true,
      classes: classes.map(c => ({
        id: c._id,
        nom: c.nom,
        niveau: c.niveau,
        montantFrais: c.montantFrais,
        effectif: c.effectif || 0
      }))
    });
  } catch (error) {
    console.error('Erreur GET /percepteur/classes:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
      classes: []
    });
  }
});

// ⬇️⬇️⬇️ UTILISER LE CONTROLLER EXTERNE ⬇️⬇️⬇️
const percepteurClasseDetailController = require('../controllers/percepteur/percepteurClasseDetailController');

router.get('/classes/:id/detail', percepteurClasseDetailController.getClasseDetail);
router.get('/classes/:id/detail-export-excel', percepteurClasseDetailController.exportClasseExcel);
router.get('/classes/:id/detail-export-pdf', percepteurClasseDetailController.exportClassePDF);

// Routes génériques (APRÈS /classes/:id/detail)
router.get('/classes/:id', percepteurClassesController.getClasseById);
router.get('/classes/:id/eleves', percepteurClassesController.getElevesByClasse);
router.get('/classes/:id/stats', percepteurClassesController.getStatsClasse);

// Détail classe
router.get('/classes/:id', percepteurClassesController.getClasseById);

// Élèves d’une classe
router.get('/classes/:id/eleves', percepteurClassesController.getElevesByClasse);

// Stats d’une classe
router.get('/classes/:id/stats', percepteurClassesController.getStatsClasse);

// ============================================================
// JOURNAL + EXPORTS (ordre corrigé)
// ============================================================

// 1) EXPORTS D’ABORD (pour ne pas matcher /journal/:date)
router.get('/journal/export-excel', async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user._id; // percepteur connecté

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Paramètre "date" requis (YYYY-MM-DD)'
      });
    }

    console.log('📦 Export Excel Journal - Date:', date, 'Percepteur:', userId.toString());

    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T23:59:59.999Z');

    // Paiements du jour pour ce percepteur
    const paiements = await Paiement.find({
      datePaiement: { $gte: start, $lte: end },
      
      anneeScolaire: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026'
    })
      .populate('classe', 'nom montantFrais')
      .populate('eleve', 'nom prenom matricule')
      .lean();

    if (paiements.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun paiement pour cette date'
      });
    }

    // (Optionnel) élèves liés, pour stats plus avancées
    const eleveIds = paiements
      .map(p => p.eleveId)
      .filter(id => !!id);

    const eleves = await Eleve.find({ _id: { $in: eleveIds } })
      .populate('classe', 'nom montantFrais')
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Collège Le Mérite - Gabkut Agency';
    workbook.created = new Date();

    const dateLibelle = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // ========== ONGLET 1 : JOURNAL ==========
    const sheet1 = workbook.addWorksheet('Journal du Jour', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    sheet1.columns = [
      { header: 'Date',       key: 'date',      width: 12 },
      { header: 'Heure',      key: 'heure',     width: 10 },
      { header: 'Élève',      key: 'eleve',     width: 25 },
      { header: 'Matricule',  key: 'matricule', width: 18 },
      { header: 'Classe',     key: 'classe',    width: 15 },
      { header: 'Mois',       key: 'mois',      width: 12 },
      { header: 'Montant',    key: 'montant',   width: 14 },
      { header: 'Mode',       key: 'mode',      width: 15 },
      { header: 'Référence',  key: 'reference', width: 24 },
      { header: 'Parent',     key: 'parent',    width: 25 },
      { header: 'Contact',    key: 'contact',   width: 18 }
    ];

    sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF667EEA' }
    };
    sheet1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet1.getRow(1).height = 25;

    paiements.forEach(p => {
      const d = new Date(p.datePaiement);
      sheet1.addRow({
        date: d.toLocaleDateString('fr-FR'),
        heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        eleve: p.eleve ? `${p.eleve.nom} ${p.eleve.prenom || ''}`.trim() : (p.eleveNom || 'N/A'),
        matricule: p.eleve?.matricule || p.eleveMatricule || 'N/A',
        classe: p.classe?.nom || p.classeNom || 'N/A',
        mois: p.mois || 'N/A',
        montant: p.montant || 0,
        mode: p.moyenPaiement || p.modePaiement || 'Cash',
        reference: p.reference || 'N/A',
        parent: p.parentNom || 'N/A',
        contact: p.parentContact || p.telephoneParent || 'N/A'
      });
    });

    sheet1.getColumn('montant').numFmt = '#,##0.00 "USD"';
    sheet1.getColumn('montant').alignment = { horizontal: 'right' };

    // ========== ONGLET 2 : RÉSUMÉ JOUR ==========
    const sheet2 = workbook.addWorksheet('Résumé du Jour');
    sheet2.getColumn(1).width = 35;
    sheet2.getColumn(2).width = 25;

    sheet2.mergeCells('A1:B1');
    sheet2.getCell('A1').value = `📄 JOURNAL DU ${dateLibelle.toUpperCase()}`;
    sheet2.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF667EEA' } };
    sheet2.getCell('A1').alignment = { horizontal: 'center' };
    sheet2.getRow(1).height = 30;

    const totalEncaisse = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const nbPaiements = paiements.length;

    const classesCounts = {};
    const heuresCounts = {};
    const modesCounts = {};

    paiements.forEach(p => {
      const nomClasse = p.classe?.nom || p.classeNom || 'N/A';
      classesCounts[nomClasse] = (classesCounts[nomClasse] || 0) + 1;

      const d = new Date(p.datePaiement);
      const heure = d.getHours();
      heuresCounts[heure] = (heuresCounts[heure] || 0) + 1;

      const mode = p.moyenPaiement || p.modePaiement || 'Autre';
      modesCounts[mode] = (modesCounts[mode] || 0) + 1;
    });

    const classeDominante = Object.entries(classesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const heurePointe = Object.entries(heuresCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const modeDominant = Object.entries(modesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const montantMoyen = nbPaiements > 0 ? totalEncaisse / nbPaiements : 0;

    sheet2.addRow([]);
    sheet2.addRow(['💰 Total Encaissé', `${totalEncaisse.toFixed(2)} USD`]);
    sheet2.addRow(['📋 Nombre de Paiements', nbPaiements]);
    sheet2.addRow(['💵 Montant Moyen', `${montantMoyen.toFixed(2)} USD`]);
    sheet2.addRow(['🎓 Classe Dominante', classeDominante]);
    sheet2.addRow(['⏰ Heure de Pointe', heurePointe !== null ? `${heurePointe}h` : '—']);
    sheet2.addRow(['💳 Mode Dominant', modeDominant]);

    for (let i = 3; i <= 9; i++) {
      sheet2.getRow(i).font = { size: 12 };
      sheet2.getCell(`A${i}`).font = { bold: true };
      sheet2.getCell(`B${i}`).alignment = { horizontal: 'right' };
      sheet2.getRow(i).height = 22;
    }

    // ========== ONGLET 3 : MODES ==========
    const sheet3 = workbook.addWorksheet('Modes Paiement');
    sheet3.columns = [
      { header: 'Mode', key: 'mode', width: 20 },
      { header: 'Montant Total', key: 'montant', width: 18 },
      { header: 'Nombre de Paiements', key: 'count', width: 22 }
    ];

    sheet3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet3.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0EA5E9' }
    };
    sheet3.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet3.getRow(1).height = 24;

    const modesAgg = {};
    paiements.forEach(p => {
      const mode = p.moyenPaiement || p.modePaiement || 'Autre';
      if (!modesAgg[mode]) {
        modesAgg[mode] = { montant: 0, count: 0 };
      }
      modesAgg[mode].montant += p.montant || 0;
      modesAgg[mode].count += 1;
    });

    Object.entries(modesAgg).forEach(([mode, val]) => {
      sheet3.addRow({
        mode,
        montant: val.montant,
        count: val.count
      });
    });

    sheet3.getColumn('montant').numFmt = '#,##0.00 "USD"';
    sheet3.getColumn('montant').alignment = { horizontal: 'right' };
    sheet3.getColumn('count').alignment = { horizontal: 'center' };

    // ========== ONGLET 4 : PAR CLASSE ==========
    const sheet4 = workbook.addWorksheet('Par Classe');
    sheet4.columns = [
      { header: 'Classe', key: 'classe', width: 20 },
      { header: 'Montant Total', key: 'montant', width: 18 },
      { header: 'Nombre de Paiements', key: 'count', width: 22 }
    ];

    sheet4.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet4.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8B5CF6' }
    };
    sheet4.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet4.getRow(1).height = 24;

    const classesAgg = {};
    paiements.forEach(p => {
      const nomClasse = p.classe?.nom || p.classeNom || 'N/A';
      if (!classesAgg[nomClasse]) {
        classesAgg[nomClasse] = { montant: 0, count: 0 };
      }
      classesAgg[nomClasse].montant += p.montant || 0;
      classesAgg[nomClasse].count += 1;
    });

    Object.entries(classesAgg).forEach(([classe, val]) => {
      sheet4.addRow({
        classe,
        montant: val.montant,
        count: val.count
      });
    });

    sheet4.getColumn('montant').numFmt = '#,##0.00 "USD"';
    sheet4.getColumn('montant').alignment = { horizontal: 'right' };
    sheet4.getColumn('count').alignment = { horizontal: 'center' };

    // ========== ENVOI ==========
    const fileNameSafeDate = date.replace(/-/g, '');
    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="journal-${fileNameSafeDate}.xlsx"`
    );
    return res.send(buffer);
  } catch (error) {
    console.error('❌ Erreur export Excel journal:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'export Excel du journal",
      error: error.message
    });
  }
});

// Export PDF journal
router.get('/journal/export-pdf', async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user._id;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Paramètre "date" requis (YYYY-MM-DD)'
      });
    }

    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T23:59:59.999Z');

    const paiements = await Paiement.find({
      datePaiement: { $gte: start, $lte: end },
      
      anneeScolaire: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026'
    })
      .sort({ datePaiement: 1 })
      .lean();

    if (paiements.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun paiement pour cette date'
      });
    }

    const dateLibelle = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // === calcul stats basiques ===
    const totalEncaisse = paiements.reduce((s, p) => s + (p.montant || 0), 0);
    const nbPaiements = paiements.length;

    const classesCounts = {};
    const heuresCounts = {};
    const modesCounts = {};
    paiements.forEach(p => {
      const classeNom = p.classeNom || 'N/A';
      classesCounts[classeNom] = (classesCounts[classeNom] || 0) + 1;

      const d = new Date(p.datePaiement);
      const h = d.getHours();
      heuresCounts[h] = (heuresCounts[h] || 0) + 1;

      const mode = p.moyenPaiement || p.modePaiement || 'Autre';
      modesCounts[mode] = (modesCounts[mode] || 0) + 1;
    });

    const classeDominante = Object.entries(classesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const heurePointe = Object.entries(heuresCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const modeDominant = Object.entries(modesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // === génération PDF simple avec pdfkit ===
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    const fileNameSafeDate = date.replace(/-/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="journal-${fileNameSafeDate}.pdf"`
    );

    doc.pipe(res);

    // En-tête
    doc
      .fontSize(16)
      .fillColor('#2563eb')
      .text('Collège Le Mérite - Journal Journalier', { align: 'center' })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .fillColor('#111827')
      .text(`Date : ${dateLibelle}`, { align: 'center' })
      .moveDown(1.5);

    // Stats
    doc
      .fontSize(12)
      .fillColor('#111827')
      .text(`Total encaissé : ${totalEncaisse.toFixed(2)} USD`)
      .text(`Nombre de paiements : ${nbPaiements}`)
      .text(`Classe dominante : ${classeDominante}`)
      .text(`Heure de pointe : ${heurePointe !== null ? heurePointe + 'h' : '—'}`)
      .text(`Mode dominant : ${modeDominant}`)
      .moveDown(1.5);

    doc
      .fontSize(13)
      .fillColor('#2563eb')
      .text('Détails des paiements :')
      .moveDown(0.5);

    // Tableau simple
    doc.fontSize(10).fillColor('#111827');

    paiements.forEach(p => {
      const d = new Date(p.datePaiement);
      const ligne = [
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        (p.eleveNom || 'N/A') + (p.classeNom ? ' - ' + p.classeNom : ''),
        (p.mois || '—') + ' | ' + (p.moyenPaiement || p.modePaiement || 'Cash'),
        `${(p.montant || 0).toFixed(2)} USD`,
        p.reference || ''
      ].join('  |  ');

      doc.text(ligne, { width: 520 });
    });

    doc.end();
  } catch (error) {
    console.error('❌ Erreur export PDF journal:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'export PDF du journal",
      error: error.message
    });
  }
});

// Export ZIP (PDF + Excel)
router.get('/journal/export-zip', async (req, res) => {
  try {
    const { date } = req.query;
    const userId = req.user._id;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Paramètre "date" requis (YYYY-MM-DD)'
      });
    }

    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T23:59:59.999Z');

    const paiements = await Paiement.find({
      datePaiement: { $gte: start, $lte: end },
      
      anneeScolaire: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026'
    })
      .populate('classe', 'nom montantFrais')
      .populate('eleve', 'nom prenom matricule')
      .sort({ datePaiement: 1 })
      .lean();

    if (paiements.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun paiement pour cette date'
      });
    }

    const ExcelJS = require('exceljs');
    const PDFDocument = require('pdfkit');
    const archiver = require('archiver');

    const fileNameSafeDate = date.replace(/-/g, '');
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="journal-${fileNameSafeDate}.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      throw err;
    });
    archive.pipe(res);

    // 1) Générer Excel en mémoire
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Collège Le Mérite - Gabkut Agency';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Journal du Jour');
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Heure', key: 'heure', width: 10 },
      { header: 'Élève', key: 'eleve', width: 25 },
      { header: 'Matricule', key: 'matricule', width: 18 },
      { header: 'Classe', key: 'classe', width: 15 },
      { header: 'Mois', key: 'mois', width: 12 },
      { header: 'Montant', key: 'montant', width: 14 },
      { header: 'Mode', key: 'mode', width: 15 },
      { header: 'Référence', key: 'reference', width: 24 }
    ];

    paiements.forEach(p => {
      const d = new Date(p.datePaiement);
      sheet.addRow({
        date: d.toLocaleDateString('fr-FR'),
        heure: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        eleve: p.eleve ? `${p.eleve.nom} ${p.eleve.prenom || ''}`.trim() : (p.eleveNom || 'N/A'),
        matricule: p.eleve?.matricule || p.eleveMatricule || 'N/A',
        classe: p.classe?.nom || p.classeNom || 'N/A',
        mois: p.mois || 'N/A',
        montant: p.montant || 0,
        mode: p.moyenPaiement || p.modePaiement || 'Cash',
        reference: p.reference || 'N/A'
      });
    });

    const excelBuffer = await workbook.xlsx.writeBuffer();
    archive.append(excelBuffer, { name: `journal-${fileNameSafeDate}.xlsx` });

    // 2) Générer PDF en mémoire
    const pdfChunks = [];
    const pdfDoc = new PDFDocument({ margin: 40, size: 'A4' });

    pdfDoc.on('data', chunk => pdfChunks.push(chunk));
    pdfDoc.on('end', () => {
      const pdfBuffer = Buffer.concat(pdfChunks);
      archive.append(pdfBuffer, { name: `journal-${fileNameSafeDate}.pdf` });
      archive.finalize();
    });

    const dateLibelle = new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    pdfDoc
      .fontSize(16)
      .fillColor('#2563eb')
      .text('Collège Le Mérite - Journal Journalier', { align: 'center' })
      .moveDown(0.5);

    pdfDoc
      .fontSize(12)
      .fillColor('#111827')
      .text(`Date : ${dateLibelle}`, { align: 'center' })
      .moveDown(1.5);

    paiements.forEach(p => {
      const d = new Date(p.datePaiement);
      const ligne = [
        d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        (p.eleveNom || 'N/A') + (p.classeNom ? ' - ' + p.classeNom : ''),
        `${(p.montant || 0).toFixed(2)} USD`,
        p.moyenPaiement || p.modePaiement || 'Cash'
      ].join('  |  ');
      pdfDoc.fontSize(10).fillColor('#111827').text(ligne, { width: 520 });
    });

    pdfDoc.end();
  } catch (error) {
    console.error('❌ Erreur export ZIP journal:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'export ZIP du journal",
      error: error.message
    });
  }
});

// 2) Ensuite seulement les routes journal “simples”
router.get('/journal', percepteurJournalController.getJournal);
router.get('/journal/:date', percepteurJournalController.getJournalByDate);

// ============================================================
// EMAILS
// ============================================================

router.post('/emails/send', percepteurEmailsController.sendEmail);
router.post('/emails/send-bulk', percepteurEmailsController.sendBulkEmails);
router.get('/emails/templates', percepteurEmailsController.getTemplates);
router.get('/emails/historique', percepteurEmailsController.getHistorique);

// ============================================================
// PAIEMENTS - AVEC PAGINATION ET FILTRES
// ============================================================

// LISTE PAIEMENTS (stats / historique) AVEC PAGINATION + FILTRES
router.get('/paiements', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      // anciens filtres (peu utilisés mais conservés pour compat)
      classe,
      mois,
      moyenPaiement,
      search,
      // nouveaux filtres envoyés par statistiques.js
      dateDebut,
      dateFin,
      classeId,
      mode
    } = req.query;

    console.log('📊 GET /percepteur/paiements (stats):', {
      page,
      limit,
      classe,
      mois,
      moyenPaiement,
      search,
      dateDebut,
      dateFin,
      classeId,
      mode,
      user: req.user.email,
      userId: req.user._id.toString()
    });

    // Filtre de base
    const filter = {
      anneeScolaire: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026'
    };

    // En prod, tu pourras filtrer par percepteurId (désactivé ici pour stats globales)
    console.log('⚠️ MODE TEST : Filtre percepteurId DÉSACTIVÉ');
    console.log('👤 User connecté:', {
      id: req.user._id.toString(),
      email: req.user.email,
      role: req.user.role
    });

    // Filtres “anciens”
    if (classe && classe.trim() !== '') {
      filter.classeNom = classe;
      console.log('Filtre classe nom appliqué:', classe);
    }

    if (mois && mois.trim() !== '') {
      filter.mois = mois;
      console.log('Filtre mois appliqué:', mois);
    }

    if (moyenPaiement && moyenPaiement.trim() !== '') {
      filter.modePaiement = moyenPaiement;
      console.log('Filtre modePaiement (ancien) appliqué:', moyenPaiement);
    }

    if (search && search.trim() !== '') {
      filter.$or = [
        { eleveNom: { $regex: search, $options: 'i' } },
        { elevePrenom: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { eleveMatricule: { $regex: search, $options: 'i' } }
      ];
      console.log('Recherche appliquée:', search);
    }

    // Filtres envoyés par le FRONT (stats.js)
    // 1) Dates
    if (dateDebut || dateFin) {
      filter.datePaiement = {};
      if (dateDebut) {
        filter.datePaiement.$gte = new Date(dateDebut + 'T00:00:00.000Z');
      }
      if (dateFin) {
        filter.datePaiement.$lte = new Date(dateFin + 'T23:59:59.999Z');
      }
      console.log('Filtre dates appliqué:', filter.datePaiement);
    }

    // 2) Classe via ID
    if (classeId && classeId.trim() !== '') {
      // Dans le modèle Paiement, tu as surtout `classeNom`.
      // On récupère donc le nom de la classe via l’ID.
      const classeDoc = await Classe.findById(classeId).select('nom').lean();
      if (classeDoc) {
        filter.classeNom = classeDoc.nom;
        console.log('Filtre classeId -> classeNom:', classeId, '=>', classeDoc.nom);
      } else {
        console.log('classeId fourni mais classe introuvable:', classeId);
      }
    }

    // 3) Mode de paiement (nouveau)
    if (mode && mode.trim() !== '') {
      filter.modePaiement = mode;
      console.log('Filtre mode (modePaiement) appliqué:', mode);
    }

    console.log('🔍 Filtre MongoDB final:', JSON.stringify(filter, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { datePaiement: -1 }; // tri par défaut

    const [paiements, total] = await Promise.all([
      Paiement.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Paiement.countDocuments(filter)
    ]);

    if (paiements.length > 0) {
      const uniquePercepteurs = [...new Set(paiements.map(p => p.percepteurId?.toString()))];
      console.log('🔍 PercepteurIds trouvés dans les paiements:', uniquePercepteurs);
      const first = paiements[0];
      console.log('🔍 Premier paiement:', {
        id: first._id,
        eleve: first.eleveNom,
        percepteurId: first.percepteurId?.toString(),
        montant: first.montant
      });
    } else {
      console.log('🔍 AUCUN PAIEMENT pour ce filtre');
      const totalTousPaiements = await Paiement.countDocuments();
      console.log('Total paiements toutes années:', totalTousPaiements);
      if (totalTousPaiements > 0) {
        const samplePaiement = await Paiement.findOne().lean();
        console.log('Exemple paiement en base:', {
          id: samplePaiement._id,
          anneeScolaire: samplePaiement.anneeScolaire,
          percepteurId: samplePaiement.percepteurId?.toString()
        });
      }
    }

    // Stats globales pour la page actuelle
    const stats = await Paiement.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          montantTotal: { $sum: '$montant' },
          totalPaiements: { $sum: 1 }
        }
      }
    ]);

    // Mode de paiement dominant
    const modeDominantResult = await Paiement.aggregate([
      { $match: filter },
      { $group: { _id: '$modePaiement', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);

    const totalPages = Math.ceil(total / parseInt(limit)) || 1;

    const response = {
      success: true,
      paiements,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total: total || 0,
        limit: parseInt(limit),
        hasNext: skip + paiements.length < total,
        hasPrev: parseInt(page) > 1
      },
      statistiques: {
        montantTotal: stats[0]?.montantTotal || 0,
        totalPaiements: stats[0]?.totalPaiements || 0,
        modeDominant: modeDominantResult[0]?._id || 'Cash'
      }
    };

    res.json(response);

    console.log(
      `${paiements.length} paiements envoyés (page ${response.pagination.currentPage}/${response.pagination.totalPages}, total: ${response.pagination.total})`
    );
  } catch (error) {
    console.error('❌ Erreur GET /percepteur/paiements:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur',
      error: error.message,
      pagination: { currentPage: 1, totalPages: 1, total: 0, limit: 50 }
    });
  }
});

// PDF de reçu (avant /paiements/:id pour éviter conflit)
router.get('/paiements/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const paiement = await Paiement.findById(id).lean();
    if (!paiement) {
      return res.status(404).json({ success: false, message: 'Paiement introuvable' });
    }

    const receiptsDir = path.join(__dirname, '..', 'receipts');
    if (!fs.existsSync(receiptsDir)) {
      return res.status(404).json({
        success: false,
        message: 'Dossier receipts introuvable'
      });
    }

    const files = fs.readdirSync(receiptsDir);
    const reference = paiement.reference;
    let pdfFile = files.find(
      f =>
        f.includes(reference) ||
        f.includes(paiement._id.toString().substring(0, 8).toUpperCase()) ||
        f.includes(paiement._id.toString().substring(0, 6).toUpperCase())
    );

    if (!pdfFile) {
      // Générer le PDF si manquant
      const generateSchoolReceiptPDF = require('../utils/generateSchoolReceiptPDF');
      const ref = reference || `COLM-${paiement._id.toString().substring(0, 8).toUpperCase()}`;

      try {
        await generateSchoolReceiptPDF(paiement, ref);
        const newFiles = fs.readdirSync(receiptsDir);
        pdfFile = newFiles.find(
          f =>
            f.includes(ref) ||
            f.includes(paiement._id.toString().substring(0, 6).toUpperCase())
        );
        if (!pdfFile) {
          throw new Error('PDF généré mais introuvable');
        }
      } catch (genError) {
        console.error('Erreur génération PDF:', genError);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la génération du PDF'
        });
      }
    }

    const pdfPath = path.join(receiptsDir, pdfFile);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFile}"`);

    const fileStream = fs.createReadStream(pdfPath);
    fileStream.on('error', (error) => {
      console.error('Erreur lecture fichier:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la lecture du PDF'
      });
    });

    fileStream.pipe(res);
  } catch (error) {
    console.error('Erreur téléchargement PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Paiement unique (JSON)
router.get('/paiements/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID de paiement invalide'
      });
    }

    const paiement = await Paiement.findById(id).lean();
    if (!paiement) {
      return res.status(404).json({
        success: false,
        message: 'Paiement introuvable'
      });
    }

    const paiementComplet = {
      id: paiement._id.toString(),
      eleveNom: paiement.eleveNom || '',
      elevePrenom: paiement.elevePrenom || '',
      eleveMatricule: paiement.eleveMatricule || '',
      classeNom: paiement.classeNom || paiement.classe || '',
      emailEleve: paiement.emailEleve || '',
      telephoneEleve: paiement.telephoneEleve || '',
      whatsappEleve: paiement.whatsappEleve || paiement.telephoneEleve || '',
      parentNom: paiement.parentNom || '',
      emailParent: paiement.emailParent || '',
      telephoneParent: paiement.telephoneParent || paiement.parentContact || '',
      whatsappParent: paiement.whatsappParent || paiement.telephoneParent || paiement.parentContact || '',
      percepteurNom: paiement.percepteurNom || '',
      percepteurEmail: paiement.percepteurEmail || paiement.emailPercepteur || '',
      percepteurTel: paiement.percepteurTel || paiement.telephonePercepteur || '',
      percepteurWhatsapp: paiement.percepteurWhatsapp || paiement.percepteurTel || '',
      montant: paiement.montant || 0,
      mois: paiement.mois || '',
      anneeConcernee: paiement.anneeConcernee || paiement.anneeScolaire || '2025-2026',
      moyenPaiement: paiement.moyenPaiement || paiement.modePaiement || 'Cash',
      noteAdministrative: paiement.noteAdministrative || paiement.noteIA || '',
      datePaiement: paiement.datePaiement || new Date(),
      reference: paiement.reference || `COLM-${paiement._id.toString().substring(0, 8).toUpperCase()}`
    };

    res.json({ success: true, paiement: paiementComplet });
  } catch (error) {
    console.error('Erreur récupération paiement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération du paiement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// CRUD paiements basique
router.post('/paiements', percepteurPaiementsController.createPaiement);
router.put('/paiements/:id', percepteurPaiementsController.updatePaiement);
router.delete('/paiements/:id', percepteurPaiementsController.deletePaiement);

// ============================================================
// EXPORT HISTORIQUE - CSV ET EXCEL
// ============================================================

router.post('/export', async (req, res) => {
  try {
    const { format, paiementIds, filtres } = req.body;

    console.log('📦 Export:', {
      format,
      paiementIdsLength: paiementIds?.length || 0,
      filtres
    });

    let query = {
      anneeScolaire: process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026'
    };

    // IDs spécifiques
    if (Array.isArray(paiementIds) && paiementIds.length > 0) {
      query._id = { $in: paiementIds };
    } else if (filtres) {
      if (filtres.classe) query.classeNom = filtres.classe;
      if (filtres.mois) query.mois = filtres.mois;
      if (filtres.moyenPaiement) query.modePaiement = filtres.moyenPaiement;
      if (filtres.dateDebut || filtres.dateFin) {
        query.datePaiement = {};
        if (filtres.dateDebut) {
          query.datePaiement.$gte = new Date(filtres.dateDebut + 'T00:00:00.000Z');
        }
        if (filtres.dateFin) {
          query.datePaiement.$lte = new Date(filtres.dateFin + 'T23:59:59.999Z');
        }
      }
      if (filtres.montantMin || filtres.montantMax) {
        query.montant = {};
        if (filtres.montantMin) {
          query.montant.$gte = parseFloat(filtres.montantMin);
        }
        if (filtres.montantMax) {
          query.montant.$lte = parseFloat(filtres.montantMax);
        }
      }
    }

    console.log('Query export:', JSON.stringify(query, null, 2));

    const data = await Paiement.find(query).sort({ datePaiement: -1 }).lean();
    console.log(`${data.length} paiements à exporter`);

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à exporter'
      });
    }

    // FORMAT CSV
    if (format === 'csv') {
      const headers = [
        'Date',
        'Heure',
        'Élève',
        'Classe',
        'Mois',
        'Montant',
        'Mode',
        'Référence',
        'Parent',
        'Contact'
      ];

      const rows = data.map(p => {
        const d = new Date(p.datePaiement);
        return [
          d.toLocaleDateString('fr-FR'),
          d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          p.eleveNom || 'N/A',
          p.classeNom || 'N/A',
          p.mois || 'N/A',
          p.montant || 0,
          p.modePaiement || 'Cash',
          p.reference || 'N/A',
          p.parentNom || 'N/A',
          p.parentContact || 'N/A'
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="historique-${Date.now()}.csv"`
      );
      return res.send(csv);
    }

    // FORMAT EXCEL
    if (format === 'xlsx' || format === 'excel') {
      const XLSX = require('xlsx');

      const worksheetData = [
        ['Date', 'Heure', 'Élève', 'Classe', 'Mois', 'Montant (USD)', 'Mode', 'Référence']
      ];

      data.forEach(p => {
        const d = new Date(p.datePaiement);
        worksheetData.push([
          d.toLocaleDateString('fr-FR'),
          d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          p.eleveNom || 'N/A',
          p.classeNom || 'N/A',
          p.mois || 'N/A',
          p.montant || 0,
          p.modePaiement || 'Cash',
          p.reference || 'N/A'
        ]);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historique');

      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="historique-${Date.now()}.xlsx"`
      );
      return res.send(buffer);
    }

    return res.status(400).json({
      success: false,
      message: `Format "${format}" non supporté. Utilisez "csv" ou "xlsx".`
    });
  } catch (error) {
    console.error('❌ Erreur export:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'export",
      error: error.message
    });
  }
});

// ============================================================
// SUPPRESSION BATCH
// ============================================================

router.delete('/paiements/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'IDs requis'
      });
    }

    const result = await Paiement.deleteMany({ _id: { $in: ids } });

    res.json({
      success: true,
      message: `${result.deletedCount} paiements supprimés`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Erreur suppression batch:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: error.message
    });
  }
});


// ============================================================
// EXPORT EXCEL STATISTIQUES - MULTI-ONGLETS
// ============================================================

router.get('/statistiques/export-excel', authMiddleware, async (req, res) => {
  try {
    const { dateDebut, dateFin, classeId, mode } = req.query;
    const userId = req.user._id;

    console.log('📦 Export Excel Statistiques - Filtres:', {
      dateDebut,
      dateFin,
      classeId,
      mode
    });

    // Construire query paiements
    const queryPaiements = { percepteurId: userId };

    if (dateDebut || dateFin) {
      queryPaiements.datePaiement = {};
      if (dateDebut) {
        queryPaiements.datePaiement.$gte = new Date(dateDebut + 'T00:00:00.000Z');
      }
      if (dateFin) {
        queryPaiements.datePaiement.$lte = new Date(dateFin + 'T23:59:59.999Z');
      }
    }

    if (classeId) {
      queryPaiements.classe = classeId;
    }

    if (mode) {
      queryPaiements.moyenPaiement = mode;
    }

    // Charger données
    const paiements = await Paiement.find(queryPaiements)
      .populate('classe', 'nom montantFrais')
      .populate('eleve', 'nom prenom matricule')
      .sort({ datePaiement: -1 })
      .lean();

    const eleves = await Eleve.find()
      .populate('classe', 'nom montantFrais')
      .lean();

    // Créer workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Collège Le Mérite - Gabkut Agency';
    workbook.created = new Date();

    // ONGLET 1 : PAIEMENTS
    const sheet1 = workbook.addWorksheet('Paiements', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
    });

    sheet1.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Heure', key: 'heure', width: 10 },
      { header: 'Élève', key: 'eleve', width: 25 },
      { header: 'Classe', key: 'classe', width: 15 },
      { header: 'Mois', key: 'mois', width: 12 },
      { header: 'Montant', key: 'montant', width: 12 },
      { header: 'Mode', key: 'mode', width: 15 },
      { header: 'Référence', key: 'reference', width: 25 },
      { header: 'Parent', key: 'parent', width: 25 },
      { header: 'Contact', key: 'contact', width: 15 }
    ];

    sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF667EEA' }
    };
    sheet1.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet1.getRow(1).height = 25;

    paiements.forEach(p => {
      const date = new Date(p.datePaiement);
      sheet1.addRow({
        date: date.toLocaleDateString('fr-FR'),
        heure: date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        eleve: p.eleve ? `${p.eleve.nom} ${p.eleve.prenom || ''}`.trim() : 'N/A',
        classe: p.classe?.nom || 'N/A',
        mois: p.mois || 'N/A',
        montant: p.montant || 0,
        mode: p.moyenPaiement || 'N/A',
        reference: p.reference || 'N/A',
        parent: p.parentNom || 'N/A',
        contact: p.parentContact || 'N/A'
      });
    });

    sheet1.getColumn('montant').numFmt = '#,##0.00 "USD"';
    sheet1.getColumn('montant').alignment = { horizontal: 'right' };

    // ONGLET 2 : STATISTIQUES GLOBALES
    const sheet2 = workbook.addWorksheet('Statistiques Globales');
    sheet2.getColumn(1).width = 30;
    sheet2.getColumn(2).width = 20;

    sheet2.mergeCells('A1:B1');
    sheet2.getCell('A1').value = 'STATISTIQUES GLOBALES';
    sheet2.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF667EEA' } };
    sheet2.getCell('A1').alignment = { horizontal: 'center' };
    sheet2.getRow(1).height = 30;

    const totalEncaisse = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const nbPaiements = paiements.length;
    const montantMoyen = nbPaiements > 0 ? totalEncaisse / nbPaiements : 0;

    const totalAttendu = eleves.reduce(
      (sum, e) => sum + (e.classe?.montantFrais || 0),
      0
    );
    const totalPaye = eleves.reduce((sum, e) => sum + (e.totalPaye || 0), 0);
    const totalImpaye = totalAttendu - totalPaye;
    const elevesAJour = eleves.filter(e => (e.resteAPayer || 0) <= 0).length;
    const elevesRetard = eleves.filter(e => (e.resteAPayer || 0) > 0).length;

    sheet2.addRow([]);
    sheet2.addRow(['Total Encaissé', `${totalEncaisse.toFixed(2)} USD`]);
    sheet2.addRow(['Nombre de Paiements', nbPaiements]);
    sheet2.addRow(['Montant Moyen', `${montantMoyen.toFixed(2)} USD`]);
    sheet2.addRow(['Total Impayé', `${totalImpaye.toFixed(2)} USD`]);
    sheet2.addRow([
      'Élèves à Jour',
      `${elevesAJour} (${eleves.length ? ((elevesAJour / eleves.length) * 100).toFixed(1) : 0}%)`
    ]);
    sheet2.addRow([
      'Élèves en Retard',
      `${elevesRetard} (${eleves.length ? ((elevesRetard / eleves.length) * 100).toFixed(1) : 0}%)`
    ]);

    for (let i = 3; i <= 8; i++) {
      sheet2.getRow(i).font = { size: 12 };
      sheet2.getCell(`A${i}`).font = { bold: true };
      sheet2.getCell(`B${i}`).alignment = { horizontal: 'right' };
      sheet2.getRow(i).height = 25;
    }

    // ONGLET 3 : TOP 10 PAYEURS
    const sheet3 = workbook.addWorksheet('Top 10 Payeurs');
    sheet3.columns = [
      { header: 'Rang', key: 'rang', width: 8 },
      { header: 'Élève', key: 'eleve', width: 30 },
      { header: 'Classe', key: 'classe', width: 15 },
      { header: 'Total Payé', key: 'totalPaye', width: 15 },
      { header: 'Avancement', key: 'avancement', width: 12 }
    ];

    sheet3.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet3.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF10B981' }
    };
    sheet3.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet3.getRow(1).height = 25;

    const top10Payeurs = eleves
      .filter(e => (e.totalPaye || 0) > 0)
      .sort((a, b) => (b.totalPaye || 0) - (a.totalPaye || 0))
      .slice(0, 10);

    top10Payeurs.forEach((e, index) => {
      const fraisTotal = e.classe?.montantFrais || 0;
      const avancement =
        fraisTotal > 0 ? (((e.totalPaye || 0) / fraisTotal) * 100).toFixed(1) : '0.0';
      sheet3.addRow({
        rang: index + 1,
        eleve: `${e.nom || ''} ${e.prenom || ''}`.trim(),
        classe: e.classe?.nom || 'N/A',
        totalPaye: e.totalPaye || 0,
        avancement: `${avancement}%`
      });
    });

    sheet3.getColumn('totalPaye').numFmt = '#,##0.00 "USD"';
    sheet3.getColumn('totalPaye').alignment = { horizontal: 'right' };
    sheet3.getColumn('rang').alignment = { horizontal: 'center' };

    // ONGLET 4 : TOP 10 RETARDATAIRES
    const sheet4 = workbook.addWorksheet('Top 10 Retardataires');
    sheet4.columns = [
      { header: 'Rang', key: 'rang', width: 8 },
      { header: 'Élève', key: 'eleve', width: 30 },
      { header: 'Classe', key: 'classe', width: 15 },
      { header: 'Reste à Payer', key: 'reste', width: 15 },
      { header: 'Payé', key: 'percentPaye', width: 12 }
    ];

    sheet4.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet4.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEF4444' }
    };
    sheet4.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet4.getRow(1).height = 25;

    const top10Retardataires = eleves
      .filter(e => (e.resteAPayer || 0) > 0)
      .sort((a, b) => (b.resteAPayer || 0) - (a.resteAPayer || 0))
      .slice(0, 10);

    top10Retardataires.forEach((e, index) => {
      const fraisTotal = e.classe?.montantFrais || 0;
      const percentPaye =
        fraisTotal > 0 ? (((e.totalPaye || 0) / fraisTotal) * 100).toFixed(1) : '0.0';
      sheet4.addRow({
        rang: index + 1,
        eleve: `${e.nom || ''} ${e.prenom || ''}`.trim(),
        classe: e.classe?.nom || 'N/A',
        reste: e.resteAPayer || 0,
        percentPaye: `${percentPaye}%`
      });
    });

    sheet4.getColumn('reste').numFmt = '#,##0.00 "USD"';
    sheet4.getColumn('reste').alignment = { horizontal: 'right' };
    sheet4.getColumn('rang').alignment = { horizontal: 'center' };

    // ONGLET 5 : RÉPARTITION PAR CLASSE
    const sheet5 = workbook.addWorksheet('Répartition par Classe');
    sheet5.columns = [
      { header: 'Classe', key: 'classe', width: 20 },
      { header: 'Nb Élèves', key: 'nbEleves', width: 12 },
      { header: 'Total Attendu', key: 'attendu', width: 15 },
      { header: 'Total Payé', key: 'paye', width: 15 },
      { header: 'Total Impayé', key: 'impaye', width: 15 },
      { header: 'Recouvrement', key: 'percent', width: 15 }
    ];

    sheet5.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet5.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8B5CF6' }
    };
    sheet5.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    sheet5.getRow(1).height = 25;

    const classesMap = {};
    eleves.forEach(e => {
      const nomClasse = e.classe?.nom || 'Sans classe';
      if (!classesMap[nomClasse]) {
        classesMap[nomClasse] = {
          nbEleves: 0,
          attendu: 0,
          paye: 0
        };
      }
      classesMap[nomClasse].nbEleves += 1;
      classesMap[nomClasse].attendu += e.classe?.montantFrais || 0;
      classesMap[nomClasse].paye += e.totalPaye || 0;
    });

    Object.entries(classesMap).forEach(([classeNom, val]) => {
      const impaye = val.attendu - val.paye;
      const percent =
        val.attendu > 0 ? ((val.paye / val.attendu) * 100).toFixed(1) : '0.0';
      sheet5.addRow({
        classe: classeNom,
        nbEleves: val.nbEleves,
        attendu: val.attendu,
        paye: val.paye,
        impaye,
        percent: `${percent}%`
      });
    });

    sheet5.getColumn('attendu').numFmt = '#,##0.00 "USD"';
    sheet5.getColumn('paye').numFmt = '#,##0.00 "USD"';
    sheet5.getColumn('impaye').numFmt = '#,##0.00 "USD"';
    sheet5.getColumn('attendu').alignment = { horizontal: 'right' };
    sheet5.getColumn('paye').alignment = { horizontal: 'right' };
    sheet5.getColumn('impaye').alignment = { horizontal: 'right' };

    // ENVOI FICHIER
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="statistiques-${Date.now()}.xlsx"`
    );
    res.send(buffer);
  } catch (error) {
    console.error('❌ Erreur export Excel statistiques:', error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'export Excel des statistiques",
      error: error.message
    });
  }
});

// ============================================================
// EXPORT DU ROUTER
// ============================================================

module.exports = router;
