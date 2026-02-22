// controllers/comptable/comptableBudgetController.js

const EcritureComptable = require("../../models/comptable/EcritureComptable");
const DepenseBudget = require("../../models/DepenseBudget");

/**
 * GET /api/comptable/budget-parametres?annee&anneeScolaire&type
 */
exports.getBudgetParametres = async (req, res, next) => {
  try {
    const { annee, anneeScolaire, type } = req.query;

    if (!annee || !anneeScolaire || !type) {
      return res.status(400).json({
        success: false,
        message: "Paramètres annee, anneeScolaire et type sont requis.",
      });
    }

    const lignes = await DepenseBudget.find({
      annee: Number(annee),
      anneeScolaire,
      type, // "fixe" | "variable" | "credit" | "epargne"
    })
      .sort({ mois: 1, categorie: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      lignes,
    });
  } catch (err) {
    console.error("Erreur getBudgetParametres:", err);
    return next(err);
  }
};

/**
 * POST /api/comptable/budget-parametres
 * body: { lignes: [{ _id?, type, annee, anneeScolaire, categorie, mois, prevu, reel, comptesPrefixes? }] }
 */
exports.saveBudgetParametres = async (req, res, next) => {
  try {
    const { lignes } = req.body;

    console.log("🟦 BACKEND saveBudgetParametres - lignes reçues:", lignes);

    if (!Array.isArray(lignes)) {
      return res.status(400).json({
        success: false,
        message: "Le corps doit contenir un tableau 'lignes'.",
      });
    }

    const ops = [];

    lignes.forEach((l) => {
      const annee = Number(l.annee);
      const mois = Number(l.mois) || 1;
      const prevu = Number(l.prevu) || 0;
      const reel = Number(l.reel) || 0;

      const base = {
        type: l.type,
        annee,
        anneeScolaire: l.anneeScolaire,
        categorie: (l.categorie || "").trim(),
        mois,
      };

      if (!base.type || !base.annee || !base.anneeScolaire || !base.categorie) {
        console.log("⚠️ Ligne ignorée (incomplète):", l);
        return;
      }

      const comptesPrefixes = Array.isArray(l.comptesPrefixes)
        ? l.comptesPrefixes.filter(
            (c) => typeof c === "string" && c.trim() !== ""
          )
        : [];

      const update = {
        $set: {
          ...base,
          prevu,
          reel,
          comptesPrefixes,
          libelle: base.categorie,
          montantPrevu: prevu,
          montantReel: reel,
        },
      };

      if (l._id) {
        console.log("📝 UPDATE par _id:", l._id, "=>", update.$set);
        ops.push({
          updateOne: {
            filter: { _id: l._id },
            update,
          },
        });
      } else {
        console.log(
          "🆕 UPSERT par clé logique:",
          base,
          "=>",
          update.$set
        );
        ops.push({
          updateOne: {
            filter: {
              type: base.type,
              annee: base.annee,
              anneeScolaire: base.anneeScolaire,
              categorie: base.categorie,
              mois: base.mois,
            },
            update,
            upsert: true,
          },
        });
      }
    });

    if (!ops.length) {
      console.log("⚠️ Aucun op bulkWrite généré");
      return res.status(200).json({
        success: true,
        message: "Aucune ligne valide à enregistrer.",
      });
    }

    const bulkResult = await DepenseBudget.bulkWrite(ops);
    console.log("✅ bulkWrite DepenseBudget result:", bulkResult);

    return res.status(200).json({
      success: true,
      message: "Paramètres budget enregistrés avec succès.",
    });
  } catch (err) {
    console.error("❌ Erreur saveBudgetParametres:", err);
    return next(err);
  }
};

// GET /api/comptable/budget-mensuel?annee=2025&mois=1
// GET /api/comptable/budget-mensuel?annee=2025&mois=1
exports.getBudgetMensuel = async (req, res, next) => {
  try {
    const annee = parseInt(req.query.annee, 10) || new Date().getFullYear();
    const mois = parseInt(req.query.mois, 10) || new Date().getMonth() + 1; // 1-12

    const dateFrom = new Date(annee, mois - 1, 1, 0, 0, 0, 0);
    const dateTo = new Date(annee, mois, 0, 23, 59, 59, 999);

    // 1) Paramètres budget (prévu) pour ce mois
    const lignesBudget = await DepenseBudget.find({
      annee,
      mois,
    }).lean();

    // 2) Écritures du mois (toutes classes)
    const ecrituresDuMois = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: dateFrom, $lte: dateTo },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
          typeOperation: "$typeOperation",
        },
      },
    ]);

    // 3) Calcul du "réel" par ligne de budget à partir des comptesPrefixes
    const lignesBudgetAvecReel = lignesBudget.map((l) => {
      const prefixes = Array.isArray(l.comptesPrefixes) ? l.comptesPrefixes : [];

      if (!prefixes.length) {
        // si pas de mapping, on garde l'ancien montantReel ou 0
        const reelAncien =
          typeof l.reel === "number" ? l.reel : l.montantReel || 0;
        return { ...l, reel: reelAncien };
      }

      let totalReel = 0;

      ecrituresDuMois.forEach((e) => {
        if (!e.compteNumero) return;
        const match = prefixes.some((p) => e.compteNumero.startsWith(p));
        if (!match) return;

        // Logique par défaut : dépenses = crédits des comptes mappés
        if (e.sens === "CREDIT") {
          totalReel += e.montant || 0;
        }
      });

      return {
        ...l,
        reel: totalReel,
      };
    });

    // 4) Réalisé global trésorerie (classe 5)
    const regexTresorerie = /^5/;

    const stats = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: dateFrom, $lte: dateTo },
        },
      },
      { $unwind: "$lignes" },
      {
        $match: {
          "lignes.compteNumero": { $regex: regexTresorerie },
        },
      },
      {
        $group: {
          _id: "$lignes.sens", // DEBIT = encaissement, CREDIT = décaissement
          total: { $sum: "$lignes.montant" },
        },
      },
    ]);

    let totalEncaissements = 0;
    let totalDecaissements = 0;
    stats.forEach((s) => {
      if (s._id === "DEBIT") totalEncaissements = s.total;
      if (s._id === "CREDIT") totalDecaissements = s.total;
    });

    const parType = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: dateFrom, $lte: dateTo },
        },
      },
      { $unwind: "$lignes" },
      {
        $match: {
          "lignes.compteNumero": { $regex: regexTresorerie },
        },
      },
      {
        $group: {
          _id: {
            typeOperation: "$typeOperation",
            sens: "$lignes.sens",
          },
          total: { $sum: "$lignes.montant" },
        },
      },
      {
        $group: {
          _id: "$_id.typeOperation",
          encaissements: {
            $sum: {
              $cond: [{ $eq: ["$_id.sens", "DEBIT"] }, "$total", 0],
            },
          },
          decaissements: {
            $sum: {
              $cond: [{ $eq: ["$_id.sens", "CREDIT"] }, "$total", 0],
            },
          },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const recapTypes = parType.map((t) => ({
      typeOperation: t._id,
      encaissements: t.encaissements || 0,
      decaissements: t.decaissements || 0,
      solde: (t.encaissements || 0) - (t.decaissements || 0),
    }));

    const soldeMois = totalEncaissements - totalDecaissements;

    return res.status(200).json({
      success: true,
      annee,
      mois,
      budget: lignesBudgetAvecReel,
      totalEncaissements,
      totalDecaissements,
      soldeMois,
      recapTypes,
    });
  } catch (err) {
    console.error("Erreur getBudgetMensuel:", err);
    return next(err);
  }
};

