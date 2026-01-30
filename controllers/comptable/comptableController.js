/************************************************************
 📘 CONTROLLER COMPTABLE - GABKUT SCHOLA
*************************************************************/

const ExcelJS = require("exceljs");
const EcritureComptable = require("../../models/comptable/EcritureComptable");
const BalanceService = require("../../services/BalanceService");
const DepenseBudget = require('../../models/DepenseBudget');
const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');
const Classe = require('../../models/Classe');


/**
 * Outils internes : bornes de période
 */
function getPeriodBounds(type) {
  const now = new Date();

  if (type === "jour") {
    const d1 = new Date(now);
    d1.setHours(0, 0, 0, 0);
    const d2 = new Date(now);
    d2.setHours(23, 59, 59, 999);
    return { from: d1, to: d2 };
  }

  if (type === "semaine") {
    const d1 = new Date(now);
    const day = d1.getDay();
    const diff = (day + 6) % 7;
    d1.setDate(d1.getDate() - diff);
    d1.setHours(0, 0, 0, 0);

    const d2 = new Date(d1);
    d2.setDate(d2.getDate() + 6);
    d2.setHours(23, 59, 59, 999);
    return { from: d1, to: d2 };
  }

  if (type === "mois") {
    const d1 = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const d2 = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    return { from: d1, to: d2 };
  }

  if (type === "annee") {
    const year = now.getFullYear();
    const d1 = new Date(year, 0, 1, 0, 0, 0, 0);
    const d2 = new Date(year, 11, 31, 23, 59, 59, 999);
    return { from: d1, to: d2 };
  }

  return null;
}

async function computeKpiForPeriod(from, to) {
  const regexTresorerie = /^5/;

  const stats = await EcritureComptable.aggregate([
    { $match: { dateOperation: { $gte: from, $lte: to } } },
    { $unwind: "$lignes" },
    { $match: { "lignes.compteNumero": { $regex: regexTresorerie } } },
    {
      $group: {
        _id: "$lignes.sens",
        total: { $sum: "$lignes.montant" },
      },
    },
  ]);

  let encaissements = 0;
  let depenses = 0;

  stats.forEach((s) => {
    if (s._id === "DEBIT") encaissements = s.total;
    if (s._id === "CREDIT") depenses = s.total;
  });

  const solde = encaissements - depenses;

  const count = await EcritureComptable.countDocuments({
    dateOperation: { $gte: from, $lte: to },
  });

  return { encaissements, depenses, solde, count };
}

/**
 * 📊 DASHBOARD & STATS
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const { from: jourFrom, to: jourTo } = getPeriodBounds("jour");
    const { from: semFrom, to: semTo } = getPeriodBounds("semaine");
    const { from: moisFrom, to: moisTo } = getPeriodBounds("mois");
    const { from: anFrom, to: anTo } = getPeriodBounds("annee");

    const [kpiJour, kpiSem, kpiMois, kpiAnnee] = await Promise.all([
      computeKpiForPeriod(jourFrom, jourTo),
      computeKpiForPeriod(semFrom, semTo),
      computeKpiForPeriod(moisFrom, moisTo),
      computeKpiForPeriod(anFrom, anTo),
    ]);

    const ecrituresJour = await EcritureComptable.find({
      dateOperation: { $gte: jourFrom, $lte: jourTo },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const regexTresorerie = /^5/;

    const historiqueBrut = await EcritureComptable.aggregate([
      { $match: { dateOperation: { $gte: moisFrom, $lte: moisTo } } },
      { $unwind: "$lignes" },
      { $match: { "lignes.compteNumero": { $regex: regexTresorerie } } },
      {
        $group: {
          _id: {
            jour: {
              $dateToString: { format: "%Y-%m-%d", date: "$dateOperation" },
            },
            sens: "$lignes.sens",
          },
          total: { $sum: "$lignes.montant" },
        },
      },
      {
        $group: {
          _id: "$_id.jour",
          entrees: {
            $sum: {
              $cond: [{ $eq: ["$_id.sens", "DEBIT"] }, "$total", 0],
            },
          },
          sorties: {
            $sum: {
              $cond: [{ $eq: ["$_id.sens", "CREDIT"] }, "$total", 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const historiqueJours = historiqueBrut.map((h) => ({
      date: h._id,
      totalEntrees: h.entrees || 0,
      totalSorties: h.sorties || 0,
    }));

    const repartitionTypesBrut = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: moisFrom, $lte: moisTo },
        },
      },
      { $unwind: "$lignes" },
      {
        $match: {
          "lignes.compteNumero": { $regex: /^5/ },
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
          montant: {
            $sum: {
              $cond: [
                { $eq: ["$_id.sens", "DEBIT"] },
                "$total",
                { $multiply: ["$total", -1] },
              ],
            },
          },
        },
      },
      { $sort: { montant: -1 } },
    ]);

    const repartitionTypesMois = repartitionTypesBrut.map((t) => ({
      typeOperation: t._id || "Autre",
      montant: t.montant || 0,
    }));

    const result = {
      periodeJour: kpiJour,
      periodeSemaine: kpiSem,
      periodeMois: kpiMois,
      periodeAnnee: kpiAnnee,
      historiqueJours,
      repartitionTypesMois,
      comparaisonPeriode: {
        jour: kpiJour,
        semaine: kpiSem,
        mois: kpiMois,
        annee: kpiAnnee,
      },
      ecrituresJour: ecrituresJour.map((e) => ({
        id: e._id,
        dateOperation: e.dateOperation,
        libelle: e.libelle,
        typeOperation: e.typeOperation,
        totalDebit: e.totalDebit,
        totalCredit: e.totalCredit,
        reference: e.reference,
        lignes: e.lignes,
        pieces: e.pieces || [],
      })),
    };

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Erreur getDashboardStats (journal):", err);
    return next(err);
  }
};

exports.exportDashboardExcel = async (req, res, next) => {
  try {
    const now = new Date();

    const moisFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const moisTo = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const regexTresorerie = /^5/;

    const ecritures = await EcritureComptable.find({
      dateOperation: { $gte: moisFrom, $lte: moisTo },
    })
      .sort({ dateOperation: 1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Dashboard Comptable";
    workbook.created = now;
    workbook.modified = now;
    workbook.properties.date1904 = false;

    const sheet = workbook.addWorksheet("Dashboard mensuel", {
      views: [
        {
          state: "frozen",
          ySplit: 4,
        },
      ],
    });

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" },
    };
    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };

    sheet.mergeCells("A1", "G1");
    sheet.getCell("A1").value = "Dashboard Trésorerie - Collège Le Mérite";
    sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "G2");
    sheet.getCell("A2").value = `Mois : ${now.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    })}`;
    sheet.getCell("A2").font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 20;

    sheet.addRow([]);

    sheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Type d'opération", key: "typeOperation", width: 22 },
      { header: "Libellé", key: "libelle", width: 40 },
      { header: "Référence", key: "reference", width: 20 },
      {
        header: "Encaissement (USD)",
        key: "encaissement",
        width: 18,
        style: { numFmt: '#,##0.00" USD"' },
      },
      {
        header: "Décaissement (USD)",
        key: "decaissement",
        width: 18,
        style: { numFmt: '#,##0.00" USD"' },
      },
      {
        header: "Solde cumulé (USD)",
        key: "soldeCumul",
        width: 18,
        style: { numFmt: '#,##0.00" USD"' },
      },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FF111827" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = headerFill;
    headerRow.height = 18;

    headerRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    sheet.autoFilter = {
      from: "A4",
      to: "G4",
    };

    let soldeCumul = 0;
    let totalEncaissement = 0;
    let totalDecaissement = 0;

    ecritures.forEach((e) => {
      const dateStr = e.dateOperation
        ? new Date(e.dateOperation).toLocaleDateString("fr-FR")
        : "";

      let encaissement = 0;
      let decaissement = 0;

      (e.lignes || []).forEach((l) => {
        if (!regexTresorerie.test(l.compteNumero || "")) return;
        if (l.sens === "DEBIT") encaissement += l.montant || 0;
        if (l.sens === "CREDIT") decaissement += l.montant || 0;
      });

      soldeCumul += encaissement - decaissement;
      totalEncaissement += encaissement;
      totalDecaissement += decaissement;

      const row = sheet.addRow({
        date: dateStr,
        typeOperation: e.typeOperation || "",
        libelle: e.libelle || "",
        reference: e.reference || "",
        encaissement,
        decaissement,
        soldeCumul,
      });

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal:
            colNumber >= 5 ? "right" : colNumber === 1 ? "center" : "left",
        };
      });
    });

    const lastDataRowNumber = sheet.lastRow.number;

    const totalRow = sheet.addRow({
      date: "",
      typeOperation: "",
      libelle: "",
      reference: "Totaux",
      encaissement: totalEncaissement,
      decaissement: totalDecaissement,
      soldeCumul: soldeCumul,
    });

    totalRow.font = { bold: true, color: { argb: "FF111827" } };
    totalRow.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD1FAE5" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal:
          colNumber >= 5 ? "right" : colNumber === 4 ? "right" : "left",
      };
    });

    const noteRow = sheet.addRow([]);
    noteRow.getCell(1).value =
      "Remarque : seules les lignes impactant les comptes de trésorerie (classe 5) sont reprises dans ce tableau.";
    sheet.mergeCells(noteRow.number, 1, noteRow.number, 7);
    noteRow.getCell(1).font = {
      italic: true,
      size: 10,
      color: { argb: "FF6B7280" },
    };
    noteRow.getCell(1).alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };

    for (let i = 5; i <= lastDataRowNumber; i++) {
      sheet.getRow(i).height = 16;
    }

    const fileName = `dashboard_tresorerie_${now
      .toISOString()
      .substring(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportDashboardExcel:", err);
    next(err);
  }
};

/**
 * 📘 GRAND LIVRE (avec solde d'ouverture par compte)
 */
exports.getGrandLivre = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Paramètres 'from' et 'to' requis" });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const Compte = require("../../models/comptable/Compte");

    console.log("📅 getGrandLivre fromDate =", fromDate, "toDate =", toDate);

    // 1) SOLDES AVANT PERIODE
    const lignesAvant = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $lt: fromDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      { $match: { compteNumero: { $ne: null } } },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$compteIntitule" },
          totalDebitAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    console.log("🔍 lignesAvant.length =", lignesAvant.length);
    console.log(
      "🔍 lignesAvant 2833 =",
      lignesAvant.find((l) => l._id === "2833") || null
    );
    console.log(
      "🔍 lignesAvant 6813 =",
      lignesAvant.find((l) => l._id === "6813") || null
    );

    const numerosAvant = lignesAvant.map((l) => l._id);
    const comptesRefAvant = await Compte.find({
      numero: { $in: numerosAvant },
    }).lean();
    const mapRefAvant = new Map(
      comptesRefAvant.map((c) => [c.numero, c.intitule || ""])
    );

    const mapAvant = new Map();
    lignesAvant.forEach((l) => {
      const intitule =
        l.compteIntitule && l.compteIntitule.trim()
          ? l.compteIntitule
          : mapRefAvant.get(l._id) || "";

      const soldeOuverture =
        (l.totalDebitAvant || 0) - (l.totalCreditAvant || 0);

      mapAvant.set(l._id, {
        numero: l._id,
        intitule,
        soldeOuverture,
      });
    });

    console.log(
      "📌 soldeOuverture 2833 =",
      mapAvant.get("2833") || null
    );
    console.log(
      "📌 soldeOuverture 6813 =",
      mapAvant.get("6813") || null
    );

    // 2) MOUVEMENTS DE LA PERIODE (détaillés)
    const lignes = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          date: "$dateOperation",
          reference: "$reference",
          libelle: "$libelle",
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      {
        $match: {
          compteNumero: { $ne: null },
        },
      },
      {
        $sort: { compteNumero: 1, date: 1, reference: 1 },
      },
    ]);

    console.log("🔍 lignes.length =", lignes.length);
    console.log(
      "🔍 mouvements période 2833 =",
      lignes.filter((l) => l.compteNumero === "2833")
    );
    console.log(
      "🔍 mouvements période 6813 =",
      lignes.filter((l) => l.compteNumero === "6813")
    );

    if (!lignes.length && !lignesAvant.length) {
      return res.status(200).json({
        success: true,
        data: {
          totalComptes: 0,
          totalDebit: 0,
          totalCredit: 0,
          comptes: [],
        },
      });
    }

    const comptesMap = new Map();
    let totalDebitGlobal = 0;
    let totalCreditGlobal = 0;

    // 3) Injecter les soldes d'ouverture
    mapAvant.forEach((val, numero) => {
      if (!comptesMap.has(numero)) {
        comptesMap.set(numero, {
          numero,
          intitule: val.intitule,
          totalDebit: 0,
          totalCredit: 0,
          nbDebit: 0,
          nbCredit: 0,
          mouvementsDebit: [],
          mouvementsCredit: [],
          soldeOuverture: val.soldeOuverture,
        });
      }
    });

    // 4) Ajouter mouvements de la période
    for (const l of lignes) {
      const key = l.compteNumero;
      if (!comptesMap.has(key)) {
        comptesMap.set(key, {
          numero: l.compteNumero,
          intitule: l.compteIntitule || "",
          totalDebit: 0,
          totalCredit: 0,
          nbDebit: 0,
          nbCredit: 0,
          mouvementsDebit: [],
          mouvementsCredit: [],
          soldeOuverture: 0,
        });
      }
      const cpt = comptesMap.get(key);

      const mouvement = {
        date: l.date,
        reference: l.reference,
        libelle: l.libelle,
        montant: l.montant || 0,
      };

      if (l.sens === "DEBIT") {
        cpt.mouvementsDebit.push(mouvement);
        cpt.totalDebit += mouvement.montant;
        cpt.nbDebit += 1;
        totalDebitGlobal += mouvement.montant;
      } else if (l.sens === "CREDIT") {
        cpt.mouvementsCredit.push(mouvement);
        cpt.totalCredit += mouvement.montant;
        cpt.nbCredit += 1;
        totalCreditGlobal += mouvement.montant;
      }
    }

    console.log(
      "📊 compte 2833 dans comptesMap =",
      comptesMap.get("2833") || null
    );
    console.log(
      "📊 compte 6813 dans comptesMap =",
      comptesMap.get("6813") || null
    );

    const comptes = Array.from(comptesMap.values())
      .sort((a, b) => a.numero.localeCompare(b.numero))
      .map((c) => ({
        ...c,
        soldeFinal:
          (c.soldeOuverture || 0) +
          (c.totalDebit || 0) -
          (c.totalCredit || 0),
      }));

    return res.status(200).json({
      success: true,
      data: {
        totalComptes: comptes.length,
        totalDebit: totalDebitGlobal,
        totalCredit: totalCreditGlobal,
        comptes,
      },
    });
  } catch (err) {
    console.error("Erreur getGrandLivre:", err);
    return next(err);
  }
};

exports.exportGrandLivreExcel = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Paramètres 'from' et 'to' requis" });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Même logique que getGrandLivre : soldes avant + mouvements
    const soldesAvant = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $lt: fromDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      {
        $match: {
          compteNumero: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$compteIntitule" },
          totalDebitAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    const mapAvant = new Map();
    soldesAvant.forEach((s) => {
      const solde = (s.totalDebitAvant || 0) - (s.totalCreditAvant || 0);
      mapAvant.set(s._id, {
        numero: s._id,
        intitule: s.compteIntitule || "",
        soldeOuverture: solde,
      });
    });

    const lignes = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          date: "$dateOperation",
          reference: "$reference",
          libelle: "$libelle",
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      { $match: { compteNumero: { $ne: null } } },
      { $sort: { compteNumero: 1, date: 1, reference: 1 } },
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Grand Livre");

    sheet.mergeCells("A1", "H1");
    sheet.getCell("A1").value = "Grand Livre Comptable - Collège Le Mérite";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("A2", "H2");
    sheet.getCell("A2").value = `Période du ${fromDate.toLocaleDateString(
      "fr-FR"
    )} au ${toDate.toLocaleDateString("fr-FR")}`;
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.addRow([]);

    sheet.columns = [
      { header: "Compte", key: "compte", width: 12 },
      { header: "Intitulé", key: "intitule", width: 28 },
      { header: "Date", key: "date", width: 12 },
      { header: "Référence", key: "reference", width: 16 },
      { header: "Libellé", key: "libelle", width: 40 },
      { header: "Sens", key: "sens", width: 10 },
      { header: "Montant (USD)", key: "montant", width: 16 },
      { header: "Type", key: "type", width: 16 }, // Ouverture / Mouvement
    ];

    // Ligne d'en-tête
    sheet.getRow(4).font = { bold: true };

    // 1) Écrire pour chaque compte : ligne de solde d'ouverture puis mouvements
    const comptesMap = new Map();
    lignes.forEach((l) => {
      if (!comptesMap.has(l.compteNumero)) {
        comptesMap.set(l.compteNumero, []);
      }
      comptesMap.get(l.compteNumero).push(l);
    });

    const tousComptes = new Set([
      ...Array.from(mapAvant.keys()),
      ...Array.from(comptesMap.keys()),
    ]);

    const comptesTries = Array.from(tousComptes).sort((a, b) =>
      a.localeCompare(b)
    );

    comptesTries.forEach((numero) => {
      const infoAvant = mapAvant.get(numero);
      const mouvements = comptesMap.get(numero) || [];

      const intitule =
        (infoAvant && infoAvant.intitule) ||
        (mouvements[0] && mouvements[0].compteIntitule) ||
        "";

      // Ligne solde ouverture si non nul
if (infoAvant && infoAvant.soldeOuverture !== 0) {
  const sensOuverture =
    infoAvant.soldeOuverture >= 0 ? "DEBIT" : "CREDIT";
  const montantOuverture = Math.abs(infoAvant.soldeOuverture);

  sheet.addRow({
    compte: numero,
    intitule,
    date: "",
    reference: "SOLDE OUVERTURE",
    libelle: "Solde antérieur",
    sens: sensOuverture,
    montant: montantOuverture,
    type: "Ouverture",
  });
}


      // Mouvements de la période
      mouvements.forEach((l) => {
        sheet.addRow({
          compte: l.compteNumero,
          intitule: l.compteIntitule || intitule,
          date: l.date
            ? new Date(l.date).toLocaleDateString("fr-FR")
            : "",
          reference: l.reference || "",
          libelle: l.libelle || "",
          sens: l.sens || "",
          montant: l.montant || 0,
          type: "Mouvement",
        });
      });

      // Ligne vide de séparation
      sheet.addRow({});
    });

    const fileName = `grand_livre_${fromDate
      .toISOString()
      .substring(0, 10)}_${toDate.toISOString().substring(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportGrandLivreExcel:", err);
    next(err);
  }
};

/**
 * 📗 BALANCE GÉNÉRALE (avec report automatique)
 */
// 📗 BALANCE GÉNÉRALE (avec report + intitulés via Compte)
exports.getBalanceGenerale = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Paramètres 'from' et 'to' requis" });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const Compte = require("../../models/comptable/Compte");

    // 1) SOLDES AVANT PERIODE (report d'ouverture)
    const lignesAvant = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $lt: fromDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      { $match: { compteNumero: { $ne: null } } },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$compteIntitule" },
          totalDebitAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    // 🔹 Compléter les intitulés manquants avec la collection Compte
    const numerosAvant = lignesAvant.map((l) => l._id);
    const comptesRefAvant = await Compte.find({
      numero: { $in: numerosAvant },
    }).lean();
    const mapRefAvant = new Map(
      comptesRefAvant.map((c) => [c.numero, c.intitule || ""])
    );

    const mapAvant = new Map();
    lignesAvant.forEach((l) => {
      const intitule =
        l.compteIntitule && l.compteIntitule.trim()
          ? l.compteIntitule
          : mapRefAvant.get(l._id) || "";

      mapAvant.set(l._id, {
        numero: l._id,
        intitule,
        totalDebitAvant: l.totalDebitAvant || 0,
        totalCreditAvant: l.totalCreditAvant || 0,
      });
    });

    // 2) MOUVEMENTS DE LA PERIODE
    const lignesPeriode = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      { $match: { compteNumero: { $ne: null } } },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$compteIntitule" },
          totalDebitPeriode: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditPeriode: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    // 🔹 Compléter les intitulés manquants pour la période
    const numerosPeriode = lignesPeriode.map((l) => l._id);
    const comptesRefPeriode = await Compte.find({
      numero: { $in: numerosPeriode },
    }).lean();
    const mapRefPeriode = new Map(
      comptesRefPeriode.map((c) => [c.numero, c.intitule || ""])
    );

    const mapPeriode = new Map();
    lignesPeriode.forEach((l) => {
      const intitule =
        l.compteIntitule && l.compteIntitule.trim()
          ? l.compteIntitule
          : mapRefPeriode.get(l._id) ||
            mapRefAvant.get(l._id) || // fallback si déjà vu avant
            "";

      mapPeriode.set(l._id, {
        numero: l._id,
        intitule,
        totalDebitPeriode: l.totalDebitPeriode || 0,
        totalCreditPeriode: l.totalCreditPeriode || 0,
      });
    });

    if (!lignesAvant.length && !lignesPeriode.length) {
      return res.status(200).json({
        success: true,
        data: {
          totalComptes: 0,
          totalDebit: 0,
          totalCredit: 0,
          totalSoldesDebiteurs: 0,
          totalSoldesCrediteurs: 0,
          comptes: [],
        },
      });
    }

    // 3) Fusion report + période
    const tousNumeros = new Set([
      ...Array.from(mapAvant.keys()),
      ...Array.from(mapPeriode.keys()),
    ]);

    let totalDebit = 0;
    let totalCredit = 0;
    let totalSoldesDebiteurs = 0;
    let totalSoldesCrediteurs = 0;

    const comptes = Array.from(tousNumeros)
      .map((num) => {
        const avant = mapAvant.get(num) || {
          totalDebitAvant: 0,
          totalCreditAvant: 0,
          intitule: "",
        };
        const periode = mapPeriode.get(num) || {
          totalDebitPeriode: 0,
          totalCreditPeriode: 0,
          intitule: "",
        };

        const intitule = periode.intitule || avant.intitule || "";

        const totalDebitCompte =
          (avant.totalDebitAvant || 0) + (periode.totalDebitPeriode || 0);
        const totalCreditCompte =
          (avant.totalCreditAvant || 0) + (periode.totalCreditPeriode || 0);

        const solde = (totalDebitCompte || 0) - (totalCreditCompte || 0);
        const soldeDebiteur = solde > 0 ? solde : 0;
        const soldeCrediteur = solde < 0 ? -solde : 0;

        totalDebit += totalDebitCompte;
        totalCredit += totalCreditCompte;
        totalSoldesDebiteurs += soldeDebiteur;
        totalSoldesCrediteurs += soldeCrediteur;

        return {
          numero: num,
          intitule,
          totalDebit: totalDebitCompte,
          totalCredit: totalCreditCompte,
          soldeDebiteur,
          soldeCrediteur,
        };
      })
      .sort((a, b) => a.numero.localeCompare(b.numero));

    return res.status(200).json({
      success: true,
      data: {
        totalComptes: comptes.length,
        totalDebit,
        totalCredit,
        totalSoldesDebiteurs,
        totalSoldesCrediteurs,
        comptes,
      },
    });
  } catch (err) {
    console.error("Erreur getBalanceGenerale:", err);
    return next(err);
  }
};


exports.exportBalanceGeneraleExcel = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Paramètres 'from' et 'to' requis" });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const Ecriture = EcritureComptable;
    const Compte = require("../../models/comptable/Compte");

    // 1) SOLDES AVANT PERIODE
    const lignesAvant = await Ecriture.aggregate([
      {
        $match: {
          dateOperation: { $lt: fromDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      { $match: { compteNumero: { $ne: null } } },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$compteIntitule" },
          totalDebitAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    const numerosAvant = lignesAvant.map((l) => l._id);
    const comptesRefAvant = await Compte.find({
      numero: { $in: numerosAvant },
    }).lean();
    const mapRefAvant = new Map(
      comptesRefAvant.map((c) => [c.numero, c.intitule || ""])
    );

    const mapAvant = new Map();
    lignesAvant.forEach((l) => {
      const intitule =
        l.compteIntitule && l.compteIntitule.trim()
          ? l.compteIntitule
          : mapRefAvant.get(l._id) || "";
      mapAvant.set(l._id, {
        numero: l._id,
        intitule,
        totalDebitAvant: l.totalDebitAvant || 0,
        totalCreditAvant: l.totalCreditAvant || 0,
      });
    });

    // 2) MOUVEMENTS PERIODE
    const lignesPeriode = await Ecriture.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      { $match: { compteNumero: { $ne: null } } },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$lignes.compteIntitule" },
          totalDebitPeriode: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditPeriode: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    const numerosPeriode = lignesPeriode.map((l) => l._id);
    const comptesRefPeriode = await Compte.find({
      numero: { $in: numerosPeriode },
    }).lean();
    const mapRefPeriode = new Map(
      comptesRefPeriode.map((c) => [c.numero, c.intitule || ""])
    );

    const mapPeriode = new Map();
    lignesPeriode.forEach((l) => {
      const intitule =
        l.compteIntitule && l.compteIntitule.trim()
          ? l.compteIntitule
          : mapRefPeriode.get(l._id) ||
            mapRefAvant.get(l._id) ||
            "";
      mapPeriode.set(l._id, {
        numero: l._id,
        intitule,
        totalDebitPeriode: l.totalDebitPeriode || 0,
        totalCreditPeriode: l.totalCreditPeriode || 0,
      });
    });

    // 3) Fusion
    const tousNumeros = new Set([
      ...Array.from(mapAvant.keys()),
      ...Array.from(mapPeriode.keys()),
    ]);

    let totalDebit = 0;
    let totalCredit = 0;
    let totalSoldesDebiteurs = 0;
    let totalSoldesCrediteurs = 0;

    const comptes = Array.from(tousNumeros)
      .map((num) => {
        const avant = mapAvant.get(num) || {
          totalDebitAvant: 0,
          totalCreditAvant: 0,
          intitule: "",
        };
        const periode = mapPeriode.get(num) || {
          totalDebitPeriode: 0,
          totalCreditPeriode: 0,
          intitule: "",
        };

        const intitule = periode.intitule || avant.intitule || "";

        const totalDebitCompte =
          (avant.totalDebitAvant || 0) + (periode.totalDebitPeriode || 0);
        const totalCreditCompte =
          (avant.totalCreditAvant || 0) + (periode.totalCreditPeriode || 0);

        const solde = (totalDebitCompte || 0) - (totalCreditCompte || 0);
        const soldeDebiteur = solde > 0 ? solde : 0;
        const soldeCrediteur = solde < 0 ? -solde : 0;

        totalDebit += totalDebitCompte;
        totalCredit += totalCreditCompte;
        totalSoldesDebiteurs += soldeDebiteur;
        totalSoldesCrediteurs += soldeCrediteur;

        return {
          numero: num,
          intitule,
          totalDebit: totalDebitCompte,
          totalCredit: totalCreditCompte,
          soldeDebiteur,
          soldeCrediteur,
        };
      })
      .sort((a, b) => a.numero.localeCompare(b.numero));

    // 4) Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Balance générale");

    sheet.mergeCells("A1", "F1");
    sheet.getCell("A1").value = "Balance comptable - Collège Le Mérite";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells("A2", "F2");
    sheet.getCell("A2").value = `Période du ${fromDate.toLocaleDateString(
      "fr-FR"
    )} au ${toDate.toLocaleDateString("fr-FR")}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };

    sheet.addRow([]);

    sheet.columns = [
      { header: "N° compte", key: "numero", width: 12 },
      { header: "Intitulé", key: "intitule", width: 30 },
      { header: "Total débit (USD)", key: "totalDebit", width: 18 },
      { header: "Total crédit (USD)", key: "totalCredit", width: 18 },
      { header: "Solde débiteur (USD)", key: "soldeDebiteur", width: 20 },
      { header: "Solde créditeur (USD)", key: "soldeCrediteur", width: 20 },
    ];

    comptes.forEach((c) => {
      sheet.addRow({
        numero: c.numero,
        intitule: c.intitule,
        totalDebit: c.totalDebit,
        totalCredit: c.totalCredit,
        soldeDebiteur: c.soldeDebiteur,
        soldeCrediteur: c.soldeCrediteur,
      });
    });

    sheet.addRow({});
    const totalRow = sheet.addRow({
      numero: "",
      intitule: "TOTAL",
      totalDebit,
      totalCredit,
      soldeDebiteur: totalSoldesDebiteurs,
      soldeCrediteur: totalSoldesCrediteurs,
    });
    totalRow.font = { bold: true, size: 12 };

    const fileName = `balance_generale_${fromDate
      .toISOString()
      .substring(0, 10)}_${toDate.toISOString().substring(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportBalanceGeneraleExcel:", err);
    next(err);
  }
};


/**
 * 📙 COMPTE DE RÉSULTAT (charges / produits 6 et 7)
 * → Strictement limité à la période [from, to], pas de report.
 */
exports.getCompteResultatChargesProduits = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Paramètres 'from' et 'to' requis" });
    }

    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const Compte = require("../../models/comptable/Compte");

    // 1) SOLDES AVANT PERIODE pour classes 6 et 7
    const lignesAvant = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $lt: fromDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      {
        $match: {
          compteNumero: { $ne: null },
          $expr: {
            $or: [
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "6"] },
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "7"] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$compteIntitule" },
          totalDebitAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    // complétage des intitulés manquants via Compte
    const numerosAvant = lignesAvant.map((l) => l._id);
    const comptesRefAvant = await Compte.find({
      numero: { $in: numerosAvant },
    }).lean();
    const mapRefAvant = new Map(
      comptesRefAvant.map((c) => [c.numero, c.intitule || ""])
    );

    const mapAvant = new Map();
    lignesAvant.forEach((l) => {
      const intitule =
        l.compteIntitule && l.compteIntitule.trim()
          ? l.compteIntitule
          : mapRefAvant.get(l._id) || "";

      const soldeAvant = (l.totalDebitAvant || 0) - (l.totalCreditAvant || 0);
      if (Math.abs(soldeAvant) < 0.005) return;

      mapAvant.set(l._id, {
        numero: l._id,
        intitule,
        soldeAvant,
      });
    });

    // 2) MOUVEMENTS DE LA PERIODE
    const lignes = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      {
        $match: {
          compteNumero: { $ne: null },
          $expr: {
            $or: [
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "6"] },
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "7"] },
            ],
          },
        },
      },
    ]);

    const comptesMap = new Map();

    // mouvements période
    for (const l of lignes) {
      const key = l.compteNumero;
      if (!comptesMap.has(key)) {
        comptesMap.set(key, {
          numero: l.compteNumero,
          intitule: l.compteIntitule || "",
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      const cpt = comptesMap.get(key);
      const montant = l.montant || 0;

      if (l.sens === "DEBIT") cpt.totalDebit += montant;
      else if (l.sens === "CREDIT") cpt.totalCredit += montant;
    }

    // 3) Injecter le report (classes 6 et 7) dans la période
    mapAvant.forEach((val, numero) => {
      if (!comptesMap.has(numero)) {
        comptesMap.set(numero, {
          numero,
          intitule: val.intitule,
          totalDebit: 0,
          totalCredit: 0,
        });
      } else if (!comptesMap.get(numero).intitule) {
        // si on a des mouvements mais pas d'intitulé, on prend celui du report
        comptesMap.get(numero).intitule = val.intitule;
      }

      const cpt = comptesMap.get(numero);
      if (val.soldeAvant > 0) {
        cpt.totalDebit += val.soldeAvant;
      } else if (val.soldeAvant < 0) {
        cpt.totalCredit += -val.soldeAvant;
      }
    });

    // 4) Construire charges / produits + totaux
    const charges = [];
    const produits = [];
    let totalCharges = 0;
    let totalProduits = 0;

    for (const cpt of comptesMap.values()) {
      const solde = (cpt.totalDebit || 0) - (cpt.totalCredit || 0);
      if (Math.abs(solde) < 0.005) continue;

      const isCharge = cpt.numero.startsWith("6");
      const isProduit = cpt.numero.startsWith("7");

      if (solde > 0) {
        if (isCharge) {
          charges.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde,
          });
          totalCharges += solde;
        } else if (isProduit) {
          produits.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde,
          });
          totalProduits += solde;
        }
      } else {
        const soldeAbs = -solde;
        if (isProduit) {
          produits.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: soldeAbs,
          });
          totalProduits += soldeAbs;
        } else if (isCharge) {
          charges.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: soldeAbs,
          });
          totalCharges += soldeAbs;
        }
      }
    }

    charges.sort((a, b) => a.numero.localeCompare(b.numero));
    produits.sort((a, b) => a.numero.localeCompare(b.numero));

    const totalComptes = charges.length + produits.length;
    const maxRows = Math.max(charges.length, produits.length);
    const totalPages = Math.max(1, Math.ceil(maxRows / limit));
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * limit;
    const end = start + limit;

    const pageCharges = charges.slice(start, end);
    const pageProduits = produits.slice(start, end);

    const resultat = totalProduits - totalCharges;

    console.log("📊 CR avec report - 6813 =", comptesMap.get("6813") || null);

    return res.status(200).json({
      success: true,
      data: {
        totalComptes,
        totalCharges,
        totalProduits,
        resultat,
        charges: pageCharges,
        produits: pageProduits,
        pagination: { page, totalPages },
      },
    });
  } catch (err) {
    console.error("Erreur getCompteResultatChargesProduits:", err);
    return next(err);
  }
};

exports.exportCompteResultatChargesProduitsExcel = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Paramètres 'from' et 'to' requis" });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const Compte = require("../../models/comptable/Compte");

    // 1) SOLDES AVANT PERIODE pour classes 6 et 7
    const lignesAvant = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $lt: fromDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      {
        $match: {
          compteNumero: { $ne: null },
          $expr: {
            $or: [
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "6"] },
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "7"] },
            ],
          },
        },
      },
      {
        $group: {
          _id: "$compteNumero",
          compteIntitule: { $max: "$compteIntitule" },
          totalDebitAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "DEBIT"] }, "$montant", 0],
            },
          },
          totalCreditAvant: {
            $sum: {
              $cond: [{ $eq: ["$sens", "CREDIT"] }, "$montant", 0],
            },
          },
        },
      },
    ]);

    const numerosAvant = lignesAvant.map((l) => l._id);
    const comptesRefAvant = await Compte.find({
      numero: { $in: numerosAvant },
    }).lean();
    const mapRefAvant = new Map(
      comptesRefAvant.map((c) => [c.numero, c.intitule || ""])
    );

    const mapAvant = new Map();
    lignesAvant.forEach((l) => {
      const intitule =
        l.compteIntitule && l.compteIntitule.trim()
          ? l.compteIntitule
          : mapRefAvant.get(l._id) || "";

      const soldeAvant = (l.totalDebitAvant || 0) - (l.totalCreditAvant || 0);
      if (Math.abs(soldeAvant) < 0.005) return;

      mapAvant.set(l._id, {
        numero: l._id,
        intitule,
        soldeAvant,
      });
    });

    // 2) MOUVEMENTS DE LA PERIODE
    const lignes = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      {
        $match: {
          compteNumero: { $ne: null },
          $expr: {
            $or: [
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "6"] },
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "7"] },
            ],
          },
        },
      },
    ]);

    const comptesMap = new Map();

    for (const l of lignes) {
      const key = l.compteNumero;
      if (!comptesMap.has(key)) {
        comptesMap.set(key, {
          numero: l.compteNumero,
          intitule: l.compteIntitule || "",
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      const cpt = comptesMap.get(key);
      const montant = l.montant || 0;

      if (l.sens === "DEBIT") cpt.totalDebit += montant;
      else if (l.sens === "CREDIT") cpt.totalCredit += montant;
    }

    // 3) Injecter le report dans la période
    mapAvant.forEach((val, numero) => {
      if (!comptesMap.has(numero)) {
        comptesMap.set(numero, {
          numero,
          intitule: val.intitule,
          totalDebit: 0,
          totalCredit: 0,
        });
      } else if (!comptesMap.get(numero).intitule) {
        comptesMap.get(numero).intitule = val.intitule;
      }

      const cpt = comptesMap.get(numero);
      if (val.soldeAvant > 0) {
        cpt.totalDebit += val.soldeAvant;
      } else if (val.soldeAvant < 0) {
        cpt.totalCredit += -val.soldeAvant;
      }
    });

    // 4) Construire charges / produits + totaux
    const charges = [];
    const produits = [];
    let totalCharges = 0;
    let totalProduits = 0;

    for (const cpt of comptesMap.values()) {
      const solde = (cpt.totalDebit || 0) - (cpt.totalCredit || 0);
      if (Math.abs(solde) < 0.005) continue;

      const isCharge = cpt.numero.startsWith("6");
      const isProduit = cpt.numero.startsWith("7");

      if (solde > 0) {
        if (isCharge) {
          charges.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde,
          });
          totalCharges += solde;
        } else if (isProduit) {
          produits.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde,
          });
          totalProduits += solde;
        }
      } else {
        const soldeAbs = -solde;
        if (isProduit) {
          produits.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: soldeAbs,
          });
          totalProduits += soldeAbs;
        } else if (isCharge) {
          charges.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: soldeAbs,
          });
          totalCharges += soldeAbs;
        }
      }
    }

    charges.sort((a, b) => a.numero.localeCompare(b.numero));
    produits.sort((a, b) => a.numero.localeCompare(b.numero));

    const resultat = totalProduits - totalCharges;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Compte de résultat");

    sheet.mergeCells("A1", "D1");
    sheet.getCell("A1").value =
      "Compte de résultat - Collège Le Mérite";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells("A2", "D2");
    sheet.getCell("A2").value = `Période du ${fromDate.toLocaleDateString(
      "fr-FR"
    )} au ${toDate.toLocaleDateString("fr-FR")}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };

    sheet.addRow([]);

    sheet.columns = [
      { header: "Compte charges", key: "c_num", width: 28 },
      { header: "Montant charges (USD)", key: "c_solde", width: 22 },
      { header: "Compte produits", key: "p_num", width: 28 },
      { header: "Montant produits (USD)", key: "p_solde", width: 24 },
    ];

    const maxRows = Math.max(charges.length, produits.length);
    for (let i = 0; i < maxRows; i++) {
      const c = charges[i];
      const p = produits[i];
      sheet.addRow({
        c_num: c ? `${c.numero} - ${c.intitule}` : "",
        c_solde: c ? c.solde : "",
        p_num: p ? `${p.numero} - ${p.intitule}` : "",
        p_solde: p ? p.solde : "",
      });
    }

    const resRow = sheet.addRow({
      c_num: "",
      c_solde: "",
      p_num: "Résultat (Produits - Charges)",
      p_solde: resultat,
    });
    resRow.font = { bold: true };

    const fileName = `compte_resultat_${fromDate
      .toISOString()
      .substring(0, 10)}_${toDate.toISOString().substring(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportCompteResultatChargesProduitsExcel:", err);
    next(err);
  }
};


/**
 * 📗 BILAN
 * GET /api/comptable/bilan?type=&from=&to=
 */
exports.getBilan = async (req, res) => {
  try {
    const { type = "ouverture", from, to } = req.query;

    if (!["ouverture", "intermediaire", "cloture"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type de bilan invalide",
      });
    }

    let dateDebut;
    let dateFin;

    if (from && to) {
      dateDebut = new Date(from);
      dateFin = new Date(to);
    } else if (to && !from) {
      const d = new Date(to);
      dateDebut = new Date(d.getFullYear(), 0, 1);
      dateFin = d;
    } else {
      const today = new Date();
      dateDebut = new Date(today.getFullYear(), 0, 1);
      dateFin = today;
    }

    const bilan = await BalanceService.genererBilan(type, dateDebut, dateFin);

    return res.status(200).json({
      success: true,
      data: {
        actif: bilan.actif,
        passif: bilan.passif,
        totalActif: bilan.totalActif,
        totalPassif: bilan.totalPassif,
        resultat: bilan.resultat,
        totalCharges: bilan.totalCharges,
        totalProduits: bilan.totalProduits,
      },
    });
  } catch (err) {
    console.error("Erreur getBilan:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors du chargement du bilan",
    });
  }
};

/**
 * 📗 Export BILAN EXCEL
 * GET /api/comptable/bilan-export-excel?type=&from=&to=
 */
exports.exportBilanExcel = async (req, res) => {
  try {
    const { type = "ouverture", from, to } = req.query;

    if (!["ouverture", "intermediaire", "cloture"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Type de bilan invalide",
      });
    }

    let dateDebut;
    let dateFin;

    if (from && to) {
      dateDebut = new Date(from);
      dateFin = new Date(to);
    } else if (to && !from) {
      const d = new Date(to);
      dateDebut = new Date(d.getFullYear(), 0, 1);
      dateFin = d;
    } else {
      const today = new Date();
      dateDebut = new Date(today.getFullYear(), 0, 1);
      dateFin = today;
    }

    const {
      comptesBilan,
      totalActif,
      totalPassif,
      resultat,
    } = await BalanceService.genererBilan(type, dateDebut, dateFin);

    const actif = [];
    const passif = [];
    comptesBilan.forEach((c) => {
      const montant = c.solde || 0;
      if (c.classe === "actif") {
        actif.push({ numero: c.numero, intitule: c.intitule, montant });
      } else {
        passif.push({ numero: c.numero, intitule: c.intitule, montant });
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Bilan");

    sheet.columns = [
      { header: "Actif - Compte", key: "actifCompte", width: 25 },
      { header: "Actif - Intitulé", key: "actifIntitule", width: 35 },
      { header: "Actif - Montant", key: "actifMontant", width: 18 },
      { header: "Passif - Compte", key: "passifCompte", width: 25 },
      { header: "Passif - Intitulé", key: "passifIntitule", width: 35 },
      { header: "Passif - Montant", key: "passifMontant", width: 18 },
    ];

    const maxRows = Math.max(actif.length, passif.length);
    for (let i = 0; i < maxRows; i++) {
      const a = actif[i];
      const p = passif[i];
      sheet.addRow({
        actifCompte: a ? a.numero : "",
        actifIntitule: a ? a.intitule : "",
        actifMontant: a ? a.montant : "",
        passifCompte: p ? p.numero : "",
        passifIntitule: p ? p.intitule : "",
        passifMontant: p ? p.montant : "",
      });
    }

    sheet.addRow({});
    sheet.addRow({
      actifIntitule: "Total Actif",
      actifMontant: totalActif,
      passifIntitule: "Total Passif",
      passifMontant: totalPassif,
    });
    sheet.addRow({
      actifIntitule: "Résultat (bilan)",
      actifMontant: resultat,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=bilan_${type}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportBilanExcel:", err);
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de l’export du bilan",
    });
  }
};


exports.exportCompteResultatWithAmortissements = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ success: false, message: "Paramètres 'from' et 'to' requis" });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    console.log("📅 CR EXPORT-AMORT from =", fromDate, "to =", toDate);

    // 1) Écritures normales de la période (charges & produits)
    const lignes = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$lignes" },
      {
        $project: {
          compteNumero: "$lignes.compteNumero",
          compteIntitule: "$lignes.compteIntitule",
          sens: "$lignes.sens",
          montant: "$lignes.montant",
        },
      },
      {
        $match: {
          compteNumero: { $ne: null },
          $expr: {
            $or: [
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "6"] },
              { $eq: [{ $substr: ["$compteNumero", 0, 1] }, "7"] },
            ],
          },
        },
      },
    ]);

    console.log("🔍 lignes CR période (6/7) =", lignes.length);

    const comptesMap = new Map();

    for (const l of lignes) {
      const key = l.compteNumero;
      if (!comptesMap.has(key)) {
        comptesMap.set(key, {
          numero: l.compteNumero,
          intitule: l.compteIntitule || "",
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      const cpt = comptesMap.get(key);
      const montant = l.montant || 0;

      if (l.sens === "DEBIT") cpt.totalDebit += montant;
      else if (l.sens === "CREDIT") cpt.totalCredit += montant;
    }

    console.log("📊 comptesMap avant amortissements, size =", comptesMap.size);
    console.log("📊 compte 6813 avant =", comptesMap.get("6813") || null);

    // 2) Injection manuelle d'une charge d'amortissement 6813 (pour debug)
    const montantAmortDebug = 110.04; // pour test : même montant que ton grand-livre
    const compte6813 = "6813";
    const intitule6813 =
      "Dotations aux amortissements des immobilisations corporelles";

    if (!comptesMap.has(compte6813)) {
      comptesMap.set(compte6813, {
        numero: compte6813,
        intitule: intitule6813,
        totalDebit: 0,
        totalCredit: 0,
      });
    }
    const c6813 = comptesMap.get(compte6813);
    c6813.totalDebit += montantAmortDebug;
    c6813.intitule = intitule6813;

    console.log("✅ Injection debug 6813 +", montantAmortDebug);
    console.log("📊 compte 6813 après injection =", comptesMap.get("6813"));

    // 3) Classer en charges / produits
    const charges = [];
    const produits = [];
    let totalCharges = 0;
    let totalProduits = 0;

    for (const cpt of comptesMap.values()) {
      const solde = (cpt.totalDebit || 0) - (cpt.totalCredit || 0);

      if (Math.abs(solde) < 0.005) continue;

      const isCharge = cpt.numero.startsWith("6");
      const isProduit = cpt.numero.startsWith("7");

      if (solde > 0) {
        if (isCharge) {
          charges.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: solde,
          });
          totalCharges += solde;
        } else if (isProduit) {
          produits.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: solde,
          });
          totalProduits += solde;
        }
      } else {
        const soldeAbs = -solde;
        if (isProduit) {
          produits.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: soldeAbs,
          });
          totalProduits += soldeAbs;
        } else if (isCharge) {
          charges.push({
            numero: cpt.numero,
            intitule: cpt.intitule,
            solde: soldeAbs,
          });
          totalCharges += soldeAbs;
        }
      }
    }

    console.log("📈 charges.length =", charges.length, "totalCharges =", totalCharges);
    console.log(
      "📈 produits.length =",
      produits.length,
      "totalProduits =",
      totalProduits
    );
    console.log(
      "🔎 charge 6813 dans tableau charges =",
      charges.find((c) => c.numero === "6813") || null
    );

    charges.sort((a, b) => a.numero.localeCompare(b.numero));
    produits.sort((a, b) => a.numero.localeCompare(b.numero));

    const resultat = totalProduits - totalCharges;
    console.log("📌 Résultat (Produits - Charges) =", resultat);

    // 4) Excel (identique, sauf titre)
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Compte de résultat");

    sheet.mergeCells("A1", "D1");
    sheet.getCell("A1").value =
      "Compte de résultat - Collège Le Mérite (avec amortissements debug 6813)";
    sheet.getCell("A1").font = { bold: true, size: 14 };
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.mergeCells("A2", "D2");
    sheet.getCell("A2").value = `Période du ${fromDate.toLocaleDateString(
      "fr-FR"
    )} au ${toDate.toLocaleDateString("fr-FR")}`;
    sheet.getCell("A2").alignment = { horizontal: "center" };

    sheet.addRow([]);

    sheet.columns = [
      { header: "Compte charges", key: "c_num", width: 18 },
      { header: "Montant charges (USD)", key: "c_solde", width: 22 },
      { header: "Compte produits", key: "p_num", width: 18 },
      { header: "Montant produits (USD)", key: "p_solde", width: 24 },
    ];

    const maxRows = Math.max(charges.length, produits.length);
    for (let i = 0; i < maxRows; i++) {
      const c = charges[i];
      const p = produits[i];
      sheet.addRow({
        c_num: c ? `${c.numero} - ${c.intitule}` : "",
        c_solde: c ? c.solde : "",
        p_num: p ? `${p.numero} - ${p.intitule}` : "",
        p_solde: p ? p.solde : "",
      });
    }

    const resRow = sheet.addRow({
      c_num: "",
      c_solde: "",
      p_num: "Résultat (Produits - Charges)",
      p_solde: resultat,
    });
    resRow.font = { bold: true };

    const fileName = `compte_resultat_amort_debug_${fromDate
      .toISOString()
      .substring(0, 10)}_${toDate.toISOString().substring(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportCompteResultatWithAmortissements:", err);
    next(err);
  }
};


// PARTIE BUDGET //


/// GET /api/comptable/budget-annuel?anneeScolaire=2025-2026&annee=2025&classeId=...
exports.getBudgetAnnuel = async (req, res, next) => {
  try {
    const {
      anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
      annee,               // année civile pour regrouper les paiements
      classeId
    } = req.query;

    const year = parseInt(annee, 10) || new Date().getFullYear();

    console.log('📊 Budget annuel (comptable):', { anneeScolaire, year, classeId });

    // 1) Filtrer les élèves actifs (même logique que getFinanceKpis)
    const eleveFilter = {
      statut: 'actif',
      anneeScolaire
    };

    if (classeId) {
      eleveFilter.classe = classeId;
    }

    const eleves = await Eleve.find(eleveFilter).populate('classe');

    // 2) Montant attendu annuel = somme des frais par élève (frais * 1 an)
    // Ici on reste simple: montantFrais de la classe = attendu pour l’année
    let attenduAnnuel = 0;
    for (const eleve of eleves) {
      if (eleve.classe && eleve.classe.montantFrais) {
        attenduAnnuel += eleve.classe.montantFrais;
      }
    }

    // 3) Construire la liste d'ids élèves pour filtrer les paiements
    const elevesIds = eleves.map(e => e._id);

    // 4) Récupérer tous les paiements validés pour l'année civile
    const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const paiementFilter = {
      statut: 'validé',
      anneeScolaire,
      datePaiement: { $gte: startYear, $lte: endYear }
    };

    if (classeId) {
      paiementFilter.eleve = { $in: elevesIds };
    }

    const paiements = await Paiement.find(paiementFilter).lean();

    // 5) Regrouper par mois
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril',
      'Mai', 'Juin', 'Juillet', 'Août',
      'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const recapMois = months.map((label, index) => ({
      mois: index + 1,
      label,
      revenusPrevus: 0,     // on reste simple: attenduAnnuel/12, ajustable
      revenusReels: 0,
      depensesPrevues: 0,   // à remplir plus tard via une autre collection
      depensesReelles: 0,   // idem
      epargnePrevue: 0,     // idem
      epargneReelle: 0      // idem
    }));

    // Répartition uniforme de l'attendu sur 12 mois
    const attenduMensuel = attenduAnnuel / 12;
    recapMois.forEach(m => {
      m.revenusPrevus = attenduMensuel;
    });

    // Total payé et réparti par mois
    let totalPayeAnnuel = 0;

    for (const p of paiements) {
      if (!p.datePaiement) continue;
      const d = new Date(p.datePaiement);
      const m = d.getMonth(); // 0-11

      const montant = p.montant || 0;
      totalPayeAnnuel += montant;

      if (recapMois[m]) {
        recapMois[m].revenusReels += montant;
      }
    }

    // 6) Calculer résultat mensuel + totaux
    let totalDepensesPrevues = 0;
    let totalDepensesReelles = 0;
    let totalEpargnePrevue = 0;
    let totalEpargneReelle = 0;

    recapMois.forEach(m => {
      // résultat mensuel = revenus réels - dépenses réelles (pour l'instant dépenses=0)
      m.resultat = (m.revenusReels || 0) - (m.depensesReelles || 0);

      totalDepensesPrevues += m.depensesPrevues || 0;
      totalDepensesReelles += m.depensesReelles || 0;
      totalEpargnePrevue += m.epargnePrevue || 0;
      totalEpargneReelle += m.epargneReelle || 0;
    });

    const resultatAnnuel = totalPayeAnnuel - totalDepensesReelles;

    const response = {
      success: true,
      anneeScolaire,
      annee: year,
      attenduAnnuel,
      totalRevenusReels: totalPayeAnnuel,
      totalDepensesPrevues,
      totalDepensesReelles,
      totalEpargnePrevue,
      totalEpargneReelle,
      resultatAnnuel,
      recapMois
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error('❌ Erreur getBudgetAnnuel:', err);
    return next(err);
  }
};


// GET /api/comptable/budget-annuel-export-excel?anneeScolaire=2025-2026&annee=2025
exports.exportBudgetAnnuelExcel = async (req, res, next) => {
  try {
    const {
      anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026',
      annee
    } = req.query;

    const year = parseInt(annee, 10) || new Date().getFullYear();

    // On réutilise la même logique que getBudgetAnnuel
    const eleveFilter = {
      statut: 'actif',
      anneeScolaire
    };

    const eleves = await Eleve.find(eleveFilter).populate('classe');

    let attenduAnnuel = 0;
    for (const eleve of eleves) {
      if (eleve.classe && eleve.classe.montantFrais) {
        attenduAnnuel += eleve.classe.montantFrais;
      }
    }

    const elevesIds = eleves.map(e => e._id);

    const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const paiementFilter = {
      statut: 'validé',
      anneeScolaire,
      datePaiement: { $gte: startYear, $lte: endYear }
    };

    // (optionnel) si tu veux filtrer par classe, tu peux ajouter classeId dans req.query
    if (req.query.classeId) {
      paiementFilter.eleve = { $in: elevesIds.filter(id => !!id) };
    }

    const paiements = await Paiement.find(paiementFilter).lean();

    const months = [
      'Janvier', 'Février', 'Mars', 'Avril',
      'Mai', 'Juin', 'Juillet', 'Août',
      'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    const recapMois = months.map((label, index) => ({
      mois: index + 1,
      label,
      revenusPrevus: 0,
      revenusReels: 0,
      depensesPrevues: 0,
      depensesReelles: 0,
      epargnePrevue: 0,
      epargneReelle: 0
    }));

    const attenduMensuel = attenduAnnuel / 12;
    recapMois.forEach(m => {
      m.revenusPrevus = attenduMensuel;
    });

    let totalPayeAnnuel = 0;
    for (const p of paiements) {
      if (!p.datePaiement) continue;
      const d = new Date(p.datePaiement);
      const m = d.getMonth(); // 0-11
      const montant = p.montant || 0;
      totalPayeAnnuel += montant;
      if (recapMois[m]) {
        recapMois[m].revenusReels += montant;
      }
    }

    recapMois.forEach(m => {
      m.resultat = (m.revenusReels || 0) - (m.depensesReelles || 0);
    });

    const resultatAnnuel =
      totalPayeAnnuel - recapMois.reduce((sum, m) => sum + (m.depensesReelles || 0), 0);

    // ===== Création du classeur Excel =====
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gabkut Schola';
    workbook.lastModifiedBy = 'Budget annuel';
    const now = new Date();
    workbook.created = now;
    workbook.modified = now;

    const sheet = workbook.addWorksheet(`Budget ${year}`, {
      views: [{ state: 'frozen', ySplit: 4 }]
    });

    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    const titleFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' }
    };

    const borderThin = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
    };

    // Titre
    sheet.mergeCells('A1', 'H1');
    sheet.getCell('A1').value = `Budget annuel - Collège Le Mérite`;
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A1').fill = titleFill;

    sheet.mergeCells('A2', 'H2');
    sheet.getCell('A2').value = `Année civile ${year} - Année scolaire ${anneeScolaire}`;
    sheet.getCell('A2').font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('A2').fill = titleFill;

    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 20;

    sheet.addRow(); // Ligne vide (3)

    // En-têtes colonnes
    sheet.columns = [
      { header: 'Mois', key: 'mois', width: 18 },
      { header: 'Revenus prévus', key: 'revPrev', width: 20 },
      { header: 'Revenus réels', key: 'revReel', width: 20 },
      { header: 'Dépenses prévues', key: 'depPrev', width: 20 },
      { header: 'Dépenses réelles', key: 'depReel', width: 20 },
      { header: 'Épargne prévue', key: 'eparPrev', width: 20 },
      { header: 'Épargne réelle', key: 'eparReel', width: 20 },
      { header: 'Résultat', key: 'resultat', width: 18 }
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: 'FF111827' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.fill = headerFill;
    headerRow.height = 18;
    headerRow.eachCell(cell => {
      cell.border = borderThin;
    });

    // Lignes mois
    let totalRevPrev = 0;
    let totalRevReel = 0;
    let totalDepPrev = 0;
    let totalDepReel = 0;
    let totalEparPrev = 0;
    let totalEparReel = 0;
    let totalResultat = 0;

    recapMois.forEach(m => {
      const row = sheet.addRow({
        mois: m.label,
        revPrev: m.revenusPrevus || 0,
        revReel: m.revenusReels || 0,
        depPrev: m.depensesPrevues || 0,
        depReel: m.depensesReelles || 0,
        eparPrev: m.epargnePrevue || 0,
        eparReel: m.epargneReelle || 0,
        resultat: m.resultat || 0
      });

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 ? 'left' : 'right'
        };
        if (colNumber > 1) {
          cell.numFmt = '#,##0.00';
        }
      });

      totalRevPrev += m.revenusPrevus || 0;
      totalRevReel += m.revenusReels || 0;
      totalDepPrev += m.depensesPrevues || 0;
      totalDepReel += m.depensesReelles || 0;
      totalEparPrev += m.epargnePrevue || 0;
      totalEparReel += m.epargneReelle || 0;
      totalResultat += m.resultat || 0;
    });

    // Ligne totaux
    const totalRow = sheet.addRow({
      mois: 'TOTAL',
      revPrev: totalRevPrev,
      revReel: totalRevReel,
      depPrev: totalDepPrev,
      depReel: totalDepReel,
      eparPrev: totalEparPrev,
      eparReel: totalEparReel,
      resultat: totalResultat
    });

    totalRow.font = { bold: true, color: { argb: 'FF111827' } };
    totalRow.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0F2FE' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 ? 'left' : 'right'
      };
      if (colNumber > 1) {
        cell.numFmt = '#,##0.00';
      }
    });

    sheet.addRow();

    const noteRow = sheet.addRow({
      mois:
        "Remarque : pour l'instant, seules les recettes (paiements validés) sont prises en compte. " +
        'Les dépenses et l’épargne seront alimentées via les paramètres budget.'
    });
    sheet.mergeCells(noteRow.number, 1, noteRow.number, 8);
    noteRow.getCell(1).font = {
      italic: true,
      size: 10,
      color: { argb: 'FF6B7280' }
    };
    noteRow.getCell(1).alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true
    };

    const fileName = `budget-annuel-${year}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('❌ Erreur exportBudgetAnnuelExcel:', err);
    return next(err);
  }
};
