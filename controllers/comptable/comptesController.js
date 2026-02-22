// controllers/comptable/comptesController.js
const Compte = require("../../models/comptable/Compte");

// Déduit simplement la classe depuis le numéro
function deriveInfosDepuisNumero(numero) {
  const classe = numero?.charAt(0) || "";
  return {
    classe,
    rubriqueNumero: "",
    rubriqueIntitule: "",
  };
}

// GET /api/comptable/comptes?page=&limit=&search=&classe=
exports.listerComptes = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.max(parseInt(req.query.limit || "25", 10), 1);

    const filter = {};
    const { search, classe } = req.query;

    if (search && search.trim().length >= 2) {
      const regex = new RegExp(search.trim(), "i");
      filter.$or = [{ numero: regex }, { intitule: regex }];
    }

    if (classe) {
      filter.numero = new RegExp("^" + classe);
    }

    const total = await Compte.countDocuments(filter);
    const comptes = await Compte.find(filter)
      .sort({ numero: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      data: comptes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    console.error("Erreur listerComptes", err);
    return res
      .status(500)
      .json({ success: false, message: "Erreur serveur (comptes)." });
  }
};

// GET /api/comptable/comptes/:id
exports.getCompte = async (req, res) => {
  try {
    const compte = await Compte.findById(req.params.id).lean();
    if (!compte) {
      return res
        .status(404)
        .json({ success: false, message: "Compte introuvable." });
    }
    return res.json({ success: true, data: compte });
  } catch (err) {
    console.error("Erreur getCompte", err);
    return res
      .status(500)
      .json({ success: false, message: "Erreur serveur (compte)." });
  }
};

// POST /api/comptable/comptes
exports.creerCompte = async (req, res) => {
  try {
    const { numero, intitule } = req.body;
    if (!numero || !intitule) {
      return res.status(400).json({
        success: false,
        message: "Numéro et intitulé sont obligatoires.",
      });
    }

    const existe = await Compte.findOne({ numero }).lean();
    if (existe) {
      return res.status(400).json({
        success: false,
        message: "Un compte avec ce numéro existe déjà.",
      });
    }

    const infos = deriveInfosDepuisNumero(numero);

    const compte = await Compte.create({
      numero,
      intitule,
      classe: infos.classe,
      rubriqueNumero: infos.rubriqueNumero,
      rubriqueIntitule: infos.rubriqueIntitule,
      soldeDebit: 0,
      soldeCredit: 0,
      soldeFinal: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Compte créé avec succès.",
      data: compte,
    });
  } catch (err) {
    console.error("Erreur creerCompte", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur (création compte).",
    });
  }
};

// PUT /api/comptable/comptes/:id
exports.mettreAJourCompte = async (req, res) => {
  try {
    const { numero, intitule } = req.body;
    if (!numero || !intitule) {
      return res.status(400).json({
        success: false,
        message: "Numéro et intitulé sont obligatoires.",
      });
    }

    const compte = await Compte.findById(req.params.id);
    if (!compte) {
      return res
        .status(404)
        .json({ success: false, message: "Compte introuvable." });
    }

    const infos = deriveInfosDepuisNumero(numero);

    compte.numero = numero;
    compte.intitule = intitule;
    compte.classe = infos.classe;
    compte.rubriqueNumero = infos.rubriqueNumero;
    compte.rubriqueIntitule = infos.rubriqueIntitule;

    await compte.save();

    return res.json({
      success: true,
      message: "Compte mis à jour avec succès.",
      data: compte,
    });
  } catch (err) {
    console.error("Erreur mettreAJourCompte", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur (mise à jour compte).",
    });
  }
};
