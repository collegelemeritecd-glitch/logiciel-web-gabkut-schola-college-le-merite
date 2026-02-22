// controllers/rh/parametresPaieController.js
const ParametresPaie = require("../../models/ParametresPaie");

// GET /api/rh/parametres?annee=&mois=
exports.getParametres = async (req, res, next) => {
  try {
    let { annee, mois } = req.query;

    const now = new Date();
    annee = parseInt(annee || now.getFullYear(), 10);
    mois = parseInt(mois || now.getMonth() + 1, 10);

    let params = await ParametresPaie.findOne({ annee, mois }).lean();

    // Si pas de ligne pour cette période, on peut retourner la dernière saisie
    if (!params) {
      params = await ParametresPaie.findOne().sort({ annee: -1, mois: -1 }).lean();
    }

    if (!params) {
      return res.status(200).json({
        success: true,
        data: null,
        message: "Aucun paramètre de paie défini pour l’instant.",
      });
    }

    return res.status(200).json({
      success: true,
      data: params,
    });
  } catch (err) {
    console.error("❌ Erreur getParametresPaie:", err);
    next(err);
  }
};

// PUT /api/rh/parametres  (création ou mise à jour pour la période)
exports.upsertParametres = async (req, res, next) => {
  try {
    const body = req.body || {};
    const now = new Date();

    const annee = parseInt(body.annee || now.getFullYear(), 10);
    const mois = parseInt(body.mois || now.getMonth() + 1, 10);

    const payload = {
      mois,
      annee,
      datePaie: body.datePaie ? new Date(body.datePaie) : now,
      actif: body.actif !== undefined ? !!body.actif : true,

      denomination: body.denomination || "",
      formeJuridique: body.formeJuridique || "",
      sigle: body.sigle || "",
      activite: body.activite || "",
      adresse: body.adresse || "",
      boitePostale: body.boitePostale || "",
      telephone: body.telephone || "",
      commune: body.commune || "",
      quartier: body.quartier || "",
      rue: body.rue || "",
      lot: body.lot || "",
      centreImpots: body.centreImpots || "",
      numeroCompteContribuable: body.numeroCompteContribuable || "",
      numeroCNSS: body.numeroCNSS || "",
      codeEtablissement: body.codeEtablissement || "",
      codeActivite: body.codeActivite || "",
      registreCommerce: body.registreCommerce || "",
      numeroCompteBancaire: body.numeroCompteBancaire || "",

      tauxITS: Number(body.tauxITS || 0),
      tauxCN: Number(body.tauxCN || 0),
      tauxCNPSRetraiteSalarie: Number(body.tauxCNPSRetraiteSalarie || 0),
      tauxCNPSRetraiteEmployeur: Number(body.tauxCNPSRetraiteEmployeur || 0),
      tauxAccidentTravail: Number(body.tauxAccidentTravail || 0),
      tauxPrestationsFamiliales: Number(body.tauxPrestationsFamiliales || 0),
      tauxFDFPTaxeApprentissage: Number(body.tauxFDFPTaxeApprentissage || 0),
      tauxFDFPFormationContinue: Number(body.tauxFDFPFormationContinue || 0),

      grilleSalaires: Array.isArray(body.grilleSalaires)
        ? body.grilleSalaires
        : [],

      indemnitesPrimes: Array.isArray(body.indemnitesPrimes)
        ? body.indemnitesPrimes
        : [],

      montantExonerePrimeTransport: Number(body.montantExonerePrimeTransport || 0),
      primeAncienneteActive:
        body.primeAncienneteActive !== undefined
          ? !!body.primeAncienneteActive
          : true,
      netAPayerArrondi: Number(body.netAPayerArrondi || 1),

      nomRepresentant: body.nomRepresentant || "",
      qualiteRepresentant: body.qualiteRepresentant || "",
    };

    if (req.user && req.user._id) {
      payload.creePar = req.user._id;
    }

    const updated = await ParametresPaie.findOneAndUpdate(
      { annee, mois },
      { $set: payload },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("❌ Erreur upsertParametresPaie:", err);
    next(err);
  }
};
