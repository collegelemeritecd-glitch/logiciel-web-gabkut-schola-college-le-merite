// controllers/comptable/immobilisations.controller.js
const Immobilisation = require('../../models/comptable/Immobilisation');
const AmortissementService = require('../../services/AmortissementService');

exports.listerImmobilisations = async (req, res, next) => {
  try {
    const immos = await Immobilisation.find({})
      .sort({ dateAcquisition: -1, code: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: immos
    });
  } catch (err) {
    console.error('Erreur listerImmobilisations', err);
    return next(err);
  }
};

exports.getImmobilisation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const immo = await Immobilisation.findById(id).lean();

    if (!immo) {
      return res.status(404).json({
        success: false,
        message: 'Immobilisation introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      data: immo
    });
  } catch (err) {
    console.error('Erreur getImmobilisation', err);
    return next(err);
  }
};

exports.creerImmobilisation = async (req, res, next) => {
  try {
    const {
      code,
      libelle,
      compteImmobilisation,
      compteAmortissement,
      compteDotation,
      dateAcquisition,
      valeurOrigine,
      duree,
      mode,
      taux
    } = req.body;

    if (!code || !libelle || !compteImmobilisation || !compteAmortissement || !compteDotation ||
        !dateAcquisition || !valeurOrigine || !duree || !taux) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires ne sont pas renseignés.'
      });
    }

    const immo = new Immobilisation({
      code,
      libelle,
      compteImmobilisation,
      compteAmortissement,
      compteDotation,
      dateAcquisition: new Date(dateAcquisition),
      valeurOrigine,
      duree,
      mode: mode || 'lineaire',
      taux,
      amortCumul: 0,
      vnc: valeurOrigine,
      estCloturee: false,
      plan: []
    });

    await immo.save();
    return res.status(201).json({
      success: true,
      message: 'Immobilisation créée avec succès.',
      data: immo
    });
  } catch (err) {
    console.error('Erreur creerImmobilisation', err);
    return next(err);
  }
};

exports.mettreAJourImmobilisation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      code,
      libelle,
      compteImmobilisation,
      compteAmortissement,
      compteDotation,
      dateAcquisition,
      valeurOrigine,
      duree,
      mode,
      taux
    } = req.body;

    const immo = await Immobilisation.findById(id);
    if (!immo) {
      return res.status(404).json({
        success: false,
        message: 'Immobilisation introuvable.'
      });
    }

    if (!code || !libelle || !compteImmobilisation || !compteAmortissement || !compteDotation ||
        !dateAcquisition || !valeurOrigine || !duree || !taux) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs obligatoires ne sont pas renseignés.'
      });
    }

    immo.code = code;
    immo.libelle = libelle;
    immo.compteImmobilisation = compteImmobilisation;
    immo.compteAmortissement = compteAmortissement;
    immo.compteDotation = compteDotation;
    immo.dateAcquisition = new Date(dateAcquisition);
    immo.valeurOrigine = valeurOrigine;
    immo.duree = duree;
    immo.mode = mode || 'lineaire';
    immo.taux = taux;

    // si on change les paramètres de base, on peut décider de régénérer le plan
    immo.plan = [];
    immo.amortCumul = 0;
    immo.vnc = valeurOrigine;
    immo.estCloturee = false;

    await immo.save();

    return res.status(200).json({
      success: true,
      message: 'Immobilisation mise à jour avec succès.',
      data: immo
    });
  } catch (err) {
    console.error('Erreur mettreAJourImmobilisation', err);
    return next(err);
  }
};

exports.supprimerImmobilisation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const immo = await Immobilisation.findById(id);

    if (!immo) {
      return res.status(404).json({
        success: false,
        message: 'Immobilisation introuvable.'
      });
    }

    // 1) Supprimer toutes les écritures d'amortissement liées à cette immo
    await AmortissementService.supprimerAmortissementsPourImmo(id);

    // 2) Supprimer l'immobilisation elle-même
    await immo.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Immobilisation et écritures d’amortissement associées supprimées avec succès.'
    });
  } catch (err) {
    console.error('Erreur supprimerImmobilisation', err);
    return next(err);
  }
};

exports.genererPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const immo = await AmortissementService.genererPlanPourImmo(id);
    return res.status(200).json({
      success: true,
      message: 'Plan d’amortissement généré avec succès.',
      data: immo
    });
  } catch (err) {
    console.error('Erreur genererPlan', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Erreur lors de la génération du plan.'
    });
  }
};

exports.getPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const immo = await Immobilisation.findById(id).lean();
    if (!immo) {
      return res.status(404).json({
        success: false,
        message: 'Immobilisation introuvable.'
      });
    }

    return res.status(200).json({
      success: true,
      data: immo.plan || []
    });
  } catch (err) {
    console.error('Erreur getPlan', err);
    return next(err);
  }
};

exports.genererAmortissementsPeriode = async (req, res, next) => {
  try {
    const { from, to } = req.body;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Les dates from et to sont requises.'
      });
    }

    const userId = req.user ? req.user.id : null;
    const ecritures = await AmortissementService.genererEcrituresPeriode(from, to, userId);

    return res.status(200).json({
      success: true,
      message: `${ecritures.length} écriture(s) d’amortissement générée(s).`,
      data: ecritures
    });
  } catch (err) {
    console.error('Erreur genererAmortissementsPeriode', err.message, err.stack);
    return res.status(400).json({
      success: false,
      message: err.message || 'Erreur de validation'
    });
  }
};
