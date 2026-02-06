// ======================================================================
// 🎛 CONTROLLER — Journal Comptable
// ======================================================================
const fs = require("fs");
const path = require("path");

const EcritureComptable = require("../../models/comptable/EcritureComptable");
const Compte = require("../../models/comptable/Compte");
const PieceComptable = require("../../models/comptable/PieceComptable");

/**
 * Génère une référence du type OP-2026-0001
 */
async function genererReference() {
  const year = new Date().getFullYear();
  const prefix = `OP-${year}-`;
  const last = await EcritureComptable.findOne({
    reference: new RegExp(`^${prefix}`),
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!last || !last.reference) return `${prefix}0001`;

  const lastNum = parseInt(last.reference.split("-").pop(), 10) || 0;
  const nextNum = String(lastNum + 1).padStart(4, "0");
  return `${prefix}${nextNum}`;
}

/**
 * POST /api/comptable/ecritures
 * Body:
 * {
 *   dateOperation: "2026-01-20",
 *   typeOperation: "Encaissement",
 *   libelle: "COLM-GABK-2025",
 *   lignes: [
 *     { compteNumero, sens: "DEBIT"/"CREDIT", montant, libelleLigne }
 *   ]
 * }
 */
exports.creerEcriture = async (req, res) => {
  try {
    const { dateOperation, typeOperation, libelle, lignes } = req.body;

    if (!dateOperation || !libelle || !Array.isArray(lignes) || lignes.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "dateOperation, libelle et au moins 2 lignes (débit/crédit) sont requis.",
      });
    }

    const numeros = [...new Set(lignes.map((l) => l.compteNumero))];
    const comptes = await Compte.find({ numero: { $in: numeros } }).lean();
    const mapComptes = {};
    comptes.forEach((c) => {
      mapComptes[c.numero] = c.intitule;
    });

    const lignesEnrichies = lignes.map((l) => ({
      compteNumero: l.compteNumero,
      compteIntitule: mapComptes[l.compteNumero] || "",
      sens: l.sens,
      montant: l.montant,
      libelleLigne: l.libelleLigne || "",
    }));

    const totalDebit = lignesEnrichies
      .filter((l) => l.sens === "DEBIT")
      .reduce((sum, l) => sum + l.montant, 0);
    const totalCredit = lignesEnrichies
      .filter((l) => l.sens === "CREDIT")
      .reduce((sum, l) => sum + l.montant, 0);

    const ref = await genererReference();

    const ecriture = new EcritureComptable({
      dateOperation: new Date(dateOperation),
      typeOperation: typeOperation || "",
      libelle,
      reference: ref,
      totalDebit,
      totalCredit,
      lignes: lignesEnrichies,
      creePar: req.user ? req.user._id : null,
    });

    await ecriture.save();

    return res.status(201).json({
      success: true,
      message: "Écriture enregistrée avec succès.",
      data: ecriture,
    });
  } catch (err) {
    console.error("Erreur création écriture:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Erreur serveur lors de l'enregistrement.",
    });
  }
};

/**
 * GET /api/comptable/ecritures?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Historique simple (journal-comptable.html)
 */
exports.listerEcritures = async (req, res, next) => {
  try {
    const query = {};
    const { from, to } = req.query;

    if (from || to) {
      query.dateOperation = {};
      if (from) query.dateOperation.$gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        query.dateOperation.$lte = d;
      }
    }

    const ecritures = await EcritureComptable.find(query)
      .sort({ dateOperation: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: ecritures.map((e) => ({
        id: e._id,
        dateOperation: e.dateOperation,
        libelle: e.libelle,
        typeOperation: e.typeOperation,
        totalDebit: e.totalDebit,
        totalCredit: e.totalCredit,
        reference: e.reference,
        lignes: e.lignes,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/comptable/ecritures/:id
 */
exports.getEcriture = async (req, res) => {
  try {
    const ecriture = await EcritureComptable.findById(req.params.id).lean();
    if (!ecriture) {
      return res
        .status(404)
        .json({ success: false, message: "Écriture introuvable." });
    }

    const pieces = await PieceComptable.find({ ecriture: ecriture._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.json({
      success: true,
      data: {
        ...ecriture,
        pieces,
      },
    });
  } catch (err) {
    console.error("Erreur get écriture:", err);
    return res.status(500).json({ success: false, message: "Erreur serveur." });
  }
};

/**
 * PUT /api/comptable/ecritures/:id
 * Modif d'une écriture (lignes & métadonnées)
 */
exports.mettreAJourEcriture = async (req, res) => {
  try {
    const { dateOperation, typeOperation, libelle, lignes } = req.body;

    const ecriture = await EcritureComptable.findById(req.params.id);
    if (!ecriture) {
      return res
        .status(404)
        .json({ success: false, message: "Écriture introuvable." });
    }

    if (!dateOperation || !libelle || !Array.isArray(lignes) || lignes.length < 2) {
      return res.status(400).json({
        success: false,
        message:
          "dateOperation, libelle et au moins 2 lignes (débit/crédit) sont requis.",
      });
    }

    const numeros = [...new Set(lignes.map((l) => l.compteNumero))];
    const comptes = await Compte.find({ numero: { $in: numeros } }).lean();
    const mapComptes = {};
    comptes.forEach((c) => {
      mapComptes[c.numero] = c.intitule;
    });

    const lignesEnrichies = lignes.map((l) => ({
      compteNumero: l.compteNumero,
      compteIntitule: mapComptes[l.compteNumero] || "",
      sens: l.sens,
      montant: l.montant,
      libelleLigne: l.libelleLigne || "",
    }));

    const totalDebit = lignesEnrichies
      .filter((l) => l.sens === "DEBIT")
      .reduce((sum, l) => sum + l.montant, 0);
    const totalCredit = lignesEnrichies
      .filter((l) => l.sens === "CREDIT")
      .reduce((sum, l) => sum + l.montant, 0);

    ecriture.dateOperation = new Date(dateOperation);
    ecriture.typeOperation = typeOperation || "";
    ecriture.libelle = libelle;
    ecriture.lignes = lignesEnrichies;
    ecriture.totalDebit = totalDebit;
    ecriture.totalCredit = totalCredit;

    await ecriture.save();

    return res.json({
      success: true,
      message: "Écriture mise à jour avec succès.",
      data: ecriture,
    });
  } catch (err) {
    console.error("Erreur mise à jour écriture:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Erreur serveur lors de la mise à jour.",
    });
  }
};

/**
 * DELETE /api/comptable/ecritures/:id
 * Supprime l'écriture + toutes ses pièces (DB + fichiers)
 */
exports.supprimerEcriture = async (req, res) => {
  try {
    const id = req.params.id;
    const ecriture = await EcritureComptable.findById(id);
    if (!ecriture) {
      return res
        .status(404)
        .json({ success: false, message: "Écriture introuvable." });
    }

    const pieces = await PieceComptable.find({ ecriture: id }).lean();
    for (const p of pieces) {
      try {
        if (p.path && fs.existsSync(p.path)) {
          fs.unlinkSync(p.path);
        }
      } catch (err) {
        console.error("Erreur suppression fichier pièce:", err);
      }
    }

    await PieceComptable.deleteMany({ ecriture: id });
    await EcritureComptable.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: "Écriture et pièces associées supprimées avec succès.",
    });
  } catch (err) {
    console.error("Erreur suppression écriture:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la suppression.",
    });
  }
};

/**
 * GET /api/comptable/comptes/autocomplete?q=41
 */
exports.autocompleteComptes = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const comptes = await Compte.find({
      $or: [{ numero: regex }, { intitule: regex }],
    })
      .sort({ numero: 1 })
      .limit(20)
      .lean();

    return res.json({
      success: true,
      data: comptes.map((c) => ({
        id: c._id,
        numero: c.numero,
        intitule: c.intitule,
      })),
    });
  } catch (err) {
    console.error("Erreur autocomplete comptes:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la recherche des comptes.",
    });
  }
};

/**
 * GET /api/comptable/ecritures-tableau
 * Tableau dashboard (paginé / filtré)
 * Query: page, limit, search, compte, from, to
 */
// GET /api/comptable/ecritures-tableau
// Query: page, limit, search, compte, typeOperation, from, to
exports.listerEcrituresTableau = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      compte = "",
      typeOperation = "",
      from,
      to,
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.max(parseInt(limit, 10) || 10, 1);

    const filter = {};

    if (from || to) {
      filter.dateOperation = {};
      if (from) filter.dateOperation.$gte = new Date(from);
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        filter.dateOperation.$lte = d;
      }
    }

    if (typeOperation) {
      filter.typeOperation = typeOperation;
    }

    if (search && search.trim().length >= 2) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [
        { libelle: regex },
        { reference: regex },
        { typeOperation: regex },
        { "lignes.compteIntitule": regex },
      ];
    }

    if (compte && compte.trim().length >= 2) {
      const regexCompte = new RegExp(compte.trim(), "i");
      filter["lignes.compteNumero"] = regexCompte;
    }

    const total = await EcritureComptable.countDocuments(filter);

    const ecritures = await EcritureComptable.find(filter)
      .sort({ dateOperation: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    const piecesParEcriture = await PieceComptable.aggregate([
      { $match: { ecriture: { $in: ecritures.map((e) => e._id) } } },
      {
        $group: {
          _id: "$ecriture",
          pieces: {
            $push: {
              _id: "$_id",
              filename: "$filename",
              originalname: "$originalname",
            },
          },
        },
      },
    ]);

    const mapPieces = {};
    piecesParEcriture.forEach((g) => {
      mapPieces[g._id.toString()] = g.pieces;
    });

    return res.json({
      success: true,
      data: ecritures.map((e) => ({
        id: e._id,
        dateOperation: e.dateOperation,
        libelle: e.libelle,
        typeOperation: e.typeOperation,
        totalDebit: e.totalDebit,
        totalCredit: e.totalCredit,
        reference: e.reference,
        lignes: e.lignes,
        pieces: mapPieces[e._id.toString()] || [],
      })),
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.max(1, Math.ceil(total / l)),
      },
    });
  } catch (err) {
    return next(err);
  }
};
