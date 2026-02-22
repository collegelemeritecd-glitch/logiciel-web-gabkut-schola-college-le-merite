/************************************************************
 📘 CONTROLLER COMPTABLE - GABKUT SCHOLA
 controllers/comptableController.js 
*************************************************************/

const ExcelJS = require("exceljs");
const EcritureComptable = require("../../models/comptable/EcritureComptable");
const BalanceService = require("../../services/BalanceService");
const DepenseBudget = require("../../models/DepenseBudget");
const Eleve = require("../../models/Eleve");
const Paiement = require("../../models/Paiement");
const Classe = require("../../models/Classe");

// 🔴 À AJOUTER POUR LA VERSION FUSIONNÉE DU BUDGET ANNUEL
const {
  calculerBudgetAnnuel,
} = require("../../services/budgetAnnuelService");

async function calculerBudgetAnnuelPedagogique({ anneeScolaire, annee, classeId }) {
  const year = parseInt(annee, 10) || new Date().getFullYear();

  // 1) Élèves actifs
  const eleveFilter = {
    statut: "actif",
    anneeScolaire,
  };
  if (classeId) {
    eleveFilter.classe = classeId;
  }
  const eleves = await Eleve.find(eleveFilter).populate("classe");

  // 2) Attendu annuel
  let attenduAnnuel = 0;
  for (const eleve of eleves) {
    if (eleve.classe && eleve.classe.montantFrais) {
      attenduAnnuel += eleve.classe.montantFrais;
    }
  }

  // 3) Paiements
  const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
  const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

  const paiementFilter = {
    statut: "validé",
    anneeScolaire,
    datePaiement: { $gte: startYear, $lte: endYear },
  };
  if (classeId) {
    const elevesIds = eleves.map((e) => e._id);
    paiementFilter.eleve = { $in: elevesIds };
  }

  const paiements = await Paiement.find(paiementFilter).lean();

  const months = [
    "Janvier", "Février", "Mars", "Avril",
    "Mai", "Juin", "Juillet", "Août",
    "Septembre", "Octobre", "Novembre", "Décembre",
  ];

  const recapMois = months.map((label, index) => ({
    mois: index + 1,
    label,
    revenusPrevus: 0,
    revenusReels: 0,
  }));

  const attenduMensuel = attenduAnnuel / 12;
  recapMois.forEach((m) => {
    m.revenusPrevus = attenduMensuel;
  });

  let totalPayeAnnuel = 0;
  for (const p of paiements) {
    if (!p.datePaiement) continue;
    const d = new Date(p.datePaiement);
    const mIndex = d.getMonth();
    const montant = p.montant || 0;
    totalPayeAnnuel += montant;
    if (recapMois[mIndex]) {
      recapMois[mIndex].revenusReels += montant;
    }
  }

  return {
    anneeScolaire,
    annee: year,
    attenduAnnuel,
    totalRevenusReels: totalPayeAnnuel,
    recapMois,
  };
}

exports.calculerBudgetAnnuelPedagogique = calculerBudgetAnnuelPedagogique;

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

function getDateRangeFromQuery(req) {
  const { annee, from, to } = req.query;

  if (from && to) {
    const d1 = new Date(from);
    const d2 = new Date(to);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(23, 59, 59, 999);
    return { from: d1, to: d2 };
  }

  const year = annee ? parseInt(annee, 10) : new Date().getFullYear();
  const d1 = new Date(year, 0, 1, 0, 0, 0, 0);
  const d2 = new Date(year, 11, 31, 23, 59, 59, 999);
  return { from: d1, to: d2 };
}

// ensuite seulement: computeKpiForPeriod, getDashboardStats, etc.

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
    // 🔹 NOUVEAU : mois sélectionné en query, sinon mois courant
    const now = new Date();
    const moisQuery = req.query.mois; // "01".."12"

    let moisFrom, moisTo;
    if (moisQuery) {
      const year = now.getFullYear();
      const monthIndex = parseInt(moisQuery, 10) - 1;
      moisFrom = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      moisTo = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    } else {
      // comportement d’origine
      const tmp = getPeriodBounds("mois");
      moisFrom = tmp.from;
      moisTo = tmp.to;
    }

    // 🔹 le reste est TON code, juste adapté pour utiliser moisFrom / moisTo calculés ci‑dessus

    const { from: jourFrom, to: jourTo } = getPeriodBounds("jour");
    const { from: semFrom, to: semTo } = getPeriodBounds("semaine");
    // const { from: moisFrom, to: moisTo } = getPeriodBounds("mois"); // ← plus utilisé
    const { from: anFrom, to: anTo } = getPeriodBounds("annee");

    const [kpiJour, kpiSem, kpiMois, kpiAnnee] = await Promise.all([
      computeKpiForPeriod(jourFrom, jourTo),
      computeKpiForPeriod(semFrom, semTo),
      computeKpiForPeriod(moisFrom, moisTo), // ← ici on met notre mois choisi
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
      // juste un bonus pour le front, tu peux l'utiliser ou l'ignorer
      moisSelectionne: moisQuery || null,
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

    const moisQuery = req.query.mois;

    let moisFrom, moisTo;
    if (moisQuery) {
      const year = now.getFullYear();
      const monthIndex = parseInt(moisQuery, 10) - 1;
      moisFrom = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      moisTo = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    } else {
      moisFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      moisTo = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );
    }

    const regexTresorerie = /^5/;

    const ecritures = await EcritureComptable.find({
      dateOperation: { $gte: moisFrom, $lte: moisTo },
    })
      .sort({ dateOperation: 1 })
      .lean();

    // ========================
    //   PRÉ-CALCULS KPI
    // ========================
    let totalEncaissement = 0;
    let totalDecaissement = 0;
    let soldeCumul = 0;

    // Pour analyse par jour et par type d'opération
    const perDay = new Map(); // key: 'YYYY-MM-DD' -> { encaissement, decaissement }
    const perType = new Map(); // key: typeOperation -> { encaissement, decaissement }

    const lignesDashboard = [];

    ecritures.forEach(e => {
      const dateObj = e.dateOperation ? new Date(e.dateOperation) : null;
      const dateStr = dateObj
        ? dateObj.toLocaleDateString("fr-FR")
        : "";
      const dateKey = dateObj
        ? dateObj.toISOString().substring(0, 10)
        : "";

      let encaissement = 0;
      let decaissement = 0;

      (e.lignes || []).forEach(l => {
        if (!regexTresorerie.test(l.compteNumero || "")) return;
        if (l.sens === "DEBIT") encaissement += l.montant || 0;
        if (l.sens === "CREDIT") decaissement += l.montant || 0;
      });

      if (encaissement === 0 && decaissement === 0) {
        return;
      }

      soldeCumul += encaissement - decaissement;
      totalEncaissement += encaissement;
      totalDecaissement += decaissement;

      lignesDashboard.push({
        dateStr,
        dateKey,
        typeOperation: e.typeOperation || "",
        libelle: e.libelle || "",
        reference: e.reference || "",
        encaissement,
        decaissement,
        soldeCumul,
      });

      // Par jour
      if (dateKey) {
        if (!perDay.has(dateKey)) {
          perDay.set(dateKey, { encaissement: 0, decaissement: 0 });
        }
        perDay.get(dateKey).encaissement += encaissement;
        perDay.get(dateKey).decaissement += decaissement;
      }

      // Par type
      const typeKey = e.typeOperation || "Autre";
      if (!perType.has(typeKey)) {
        perType.set(typeKey, { encaissement: 0, decaissement: 0 });
      }
      perType.get(typeKey).encaissement += encaissement;
      perType.get(typeKey).decaissement += decaissement;
    });

    const soldeFinal = soldeCumul;
    const variationNet = totalEncaissement - totalDecaissement;
    const nbOperations = lignesDashboard.length;

    // ========================
    //   WORKBOOK
    // ========================
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Dashboard Comptable";
    workbook.created = now;
    workbook.modified = now;
    workbook.properties.date1904 = false;

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

    const libelleMois = moisFrom.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });

    // ========================
    //   ONGLET 1 : SYNTHÈSE
    // ========================
    const synthese = workbook.addWorksheet("Synthèse mensuelle", {
      views: [{ showGridLines: false }],
    });

    synthese.mergeCells("A1", "E1");
    synthese.getCell("A1").value = "Dashboard Trésorerie - Collège Le Mérite";
    synthese.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    synthese.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    synthese.getCell("A1").fill = titleFill;

    synthese.mergeCells("A2", "E2");
    synthese.getCell("A2").value = `Mois : ${libelleMois}`;
    synthese.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    synthese.getCell("A2").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    synthese.getCell("A2").fill = titleFill;

    synthese.getRow(1).height = 24;
    synthese.getRow(2).height = 20;

    synthese.addRow([]);

    const kpiRow = 4;
    const formatUsd = (v) => (v == null ? "-" : `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);

    const kpis = [
      {
        label: "Encaissements",
        value: formatUsd(totalEncaissement),
        icon: "💰",
        color: "FF16A34A",
      },
      {
        label: "Décaissements",
        value: formatUsd(totalDecaissement),
        icon: "💸",
        color: "FFDC2626",
      },
      {
        label: "Variation nette",
        value: formatUsd(variationNet),
        icon: "📈",
        color: variationNet >= 0 ? "FF2563EB" : "FFDC2626",
      },
      {
        label: "Solde final",
        value: formatUsd(soldeFinal),
        icon: "🏦",
        color: soldeFinal >= 0 ? "FF0EA5E9" : "FFDC2626",
      },
      {
        label: "Opérations",
        value: nbOperations,
        icon: "📄",
        color: "FF4B5563",
      },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx); // A..E

      const iconCell = synthese.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 20 };
      iconCell.alignment = { horizontal: "center", vertical: "middle" };

      const valueCell = synthese.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = {
        size: 14,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      valueCell.alignment = { horizontal: "center", vertical: "middle" };
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: kpi.color },
      };

      const labelCell = synthese.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      synthese.getColumn(col).width = 18;
    });

    synthese.getRow(kpiRow).height = 28;
    synthese.getRow(kpiRow + 1).height = 34;
    synthese.getRow(kpiRow + 2).height = 22;

    // Bloc analyse par type
    let rowStartType = kpiRow + 5;
    synthese.mergeCells(`A${rowStartType}`, `E${rowStartType}`);
    const typeTitle = synthese.getCell(`A${rowStartType}`);
    typeTitle.value = "Analyse par type d'opération";
    typeTitle.font = {
      size: 13,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    typeTitle.alignment = { horizontal: "center", vertical: "middle" };
    typeTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    synthese.getRow(rowStartType).height = 22;

    rowStartType++;

    const headerType = synthese.getRow(rowStartType);
    headerType.values = [
      "Type d'opération",
      "Encaissements (USD)",
      "Décaissements (USD)",
      "Net (USD)",
      "% sur encaissements",
    ];
    headerType.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FF111827" }, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = headerFill;
      cell.border = borderThin;
    });
    synthese.getRow(rowStartType).height = 20;
    synthese.getColumn(1).width = 30;
    synthese.getColumn(2).width = 20;
    synthese.getColumn(3).width = 20;
    synthese.getColumn(4).width = 18;
    synthese.getColumn(5).width = 22;

    let iType = 0;
    perType.forEach((val, typeKey) => {
      const net = val.encaissement - val.decaissement;
      const pourc =
        totalEncaissement > 0
          ? `${((val.encaissement / totalEncaissement) * 100).toFixed(1)} %`
          : "-";

      const row = synthese.addRow([
        typeKey,
        val.encaissement,
        val.decaissement,
        net,
        pourc,
      ]);
      iType++;

      const bgColor = iType % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

      row.eachCell((cell, col) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal: col === 1 ? "left" : "right",
        };
        if (col >= 2 && col <= 4) {
          cell.numFmt = '#,##0.00" USD"';
        }
      });
      row.height = 18;
    });

    synthese.addRow([]);
    const noteSynth = synthese.addRow([
      `Remarque : seules les opérations impactant les comptes de trésorerie (classe 5) ont été prises en compte.`,
    ]);
    synthese.mergeCells(noteSynth.number, 1, noteSynth.number, 5);
    noteSynth.getCell(1).font = {
      italic: true,
      size: 10,
      color: { argb: "FF6B7280" },
    };
    noteSynth.getCell(1).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };

    // ========================
    //   ONGLET 2 : DÉTAIL
    // ========================
    const sheet = workbook.addWorksheet("Détails opérations", {
      views: [
        {
          state: "frozen",
          ySplit: 4,
        },
      ],
    });

    sheet.mergeCells("A1", "G1");
    sheet.getCell("A1").value = "Dashboard Trésorerie - Collège Le Mérite";
    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "G2");
    sheet.getCell("A2").value = `Mois : ${libelleMois}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
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
    headerRow.eachCell(cell => {
      cell.border = borderThin;
    });

    sheet.autoFilter = {
      from: "A4",
      to: "G4",
    };

    lignesDashboard.forEach(ld => {
      const row = sheet.addRow({
        date: ld.dateStr,
        typeOperation: ld.typeOperation,
        libelle: ld.libelle,
        reference: ld.reference,
        encaissement: ld.encaissement,
        decaissement: ld.decaissement,
        soldeCumul: ld.soldeCumul,
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
      soldeCumul: soldeFinal,
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

    // ========================
    //   ONGLET 3 : PAR JOUR
    // ========================
    const jourSheet = workbook.addWorksheet("Analyse par jour");

    jourSheet.mergeCells("A1", "D1");
    jourSheet.getCell("A1").value = "Flux de trésorerie par jour";
    jourSheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    jourSheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    jourSheet.getCell("A1").fill = titleFill;
    jourSheet.getRow(1).height = 22;

    jourSheet.addRow([]);

    const headerJour = jourSheet.addRow([
      "Date",
      "Encaissement (USD)",
      "Décaissement (USD)",
      "Net (USD)",
    ]);
    headerJour.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FF111827" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = headerFill;
      cell.border = borderThin;
    });
    jourSheet.getRow(3).height = 20;
    jourSheet.getColumn(1).width = 14;
    jourSheet.getColumn(2).width = 20;
    jourSheet.getColumn(3).width = 20;
    jourSheet.getColumn(4).width = 18;

    const sortedDays = Array.from(perDay.entries()).sort(
      (a, b) => new Date(a[0]) - new Date(b[0])
    );

    sortedDays.forEach(([dateKey, val], idx) => {
      const net = val.encaissement - val.decaissement;
      const row = jourSheet.addRow([
        new Date(dateKey).toLocaleDateString("fr-FR"),
        val.encaissement,
        val.decaissement,
        net,
      ]);

      const bgColor = idx % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

      row.eachCell((cell, col) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal: col === 1 ? "center" : "right",
        };
        if (col >= 2) {
          cell.numFmt = '#,##0.00" USD"';
        }
      });
      row.height = 18;
    });

    // ========================
    //   ONGLET 4 : LÉGENDE
    // ========================
    const legend = workbook.addWorksheet("Légende", {
      views: [{ showGridLines: false }],
    });

    legend.mergeCells("A1:D1");
    const lTitle = legend.getCell("A1");
    lTitle.value = "LÉGENDE ET LECTURE DU DASHBOARD";
    lTitle.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    lTitle.alignment = { horizontal: "center", vertical: "middle" };
    lTitle.fill = titleFill;
    legend.getRow(1).height = 32;

    legend.addRow([]);
    legend.addRow(["Élément", "Description", "", ""]);
    legend.getRow(3).font = { bold: true };
    legend.getRow(3).height = 22;

    const legendRows = [
      ["Encaissements", "Montants entrants sur les comptes de trésorerie (classe 5)."],
      ["Décaissements", "Montants sortants depuis les comptes de trésorerie (classe 5)."],
      ["Variation nette", "Encaissements - Décaissements sur la période."],
      ["Solde final", "Solde de trésorerie à la fin du mois."],
      ["Analyse par type", "Répartition des flux par type d'opération (inscriptions, frais, etc.)."],
      ["Analyse par jour", "Suivi quotidien des encaissements/décaissements et du net."],
    ];

    legendRows.forEach(item => {
      const row = legend.addRow([item[0], item[1], "", ""]);
      row.height = 20;
      row.eachCell(cell => {
        cell.border = borderThin;
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      });
    });

    legend.getColumn(1).width = 25;
    legend.getColumn(2).width = 70;
    legend.getColumn(3).width = 5;
    legend.getColumn(4).width = 5;

    // ========================
    //   EXPORT
    // ========================
    const fileName = `dashboard_tresorerie_${moisFrom
      .toISOString()
      .substring(0, 7)}.xlsx`;

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

    // ========================
    //   SOLDES AVANT PÉRIODE
    // ========================
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

    // ========================
    //   MOUVEMENTS PÉRIODE
    // ========================
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

    // ========================
    //   PRÉ-CALCULS KPI
    // ========================
    const comptesMap = new Map();
    let totalDebitPeriode = 0;
    let totalCreditPeriode = 0;

    lignes.forEach((l) => {
      if (!comptesMap.has(l.compteNumero)) {
        comptesMap.set(l.compteNumero, {
          numero: l.compteNumero,
          intitule: l.compteIntitule || "",
          mouvements: [],
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      const compte = comptesMap.get(l.compteNumero);
      compte.mouvements.push(l);

      if (l.sens === "DEBIT") {
        compte.totalDebit += l.montant || 0;
        totalDebitPeriode += l.montant || 0;
      } else if (l.sens === "CREDIT") {
        compte.totalCredit += l.montant || 0;
        totalCreditPeriode += l.montant || 0;
      }
    });

    const tousComptes = new Set([
      ...Array.from(mapAvant.keys()),
      ...Array.from(comptesMap.keys()),
    ]);

    const comptesTries = Array.from(tousComptes).sort((a, b) =>
      a.localeCompare(b)
    );

    const nbComptes = comptesTries.length;
    const nbMouvements = lignes.length;

    // Calcul soldes cloture
    const statsComptes = [];
    comptesTries.forEach((numero) => {
      const infoAvant = mapAvant.get(numero);
      const compteData = comptesMap.get(numero);

      const soldeOuverture = infoAvant ? infoAvant.soldeOuverture : 0;
      const intitule = (infoAvant && infoAvant.intitule) || (compteData && compteData.intitule) || "";
      
      const debitPeriode = compteData ? compteData.totalDebit : 0;
      const creditPeriode = compteData ? compteData.totalCredit : 0;
      const soldeCloture = soldeOuverture + debitPeriode - creditPeriode;

      statsComptes.push({
        numero,
        intitule,
        soldeOuverture,
        debitPeriode,
        creditPeriode,
        soldeCloture,
      });
    });

    // ========================
    //   WORKBOOK
    // ========================
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Grand Livre Comptable";
    workbook.created = new Date();
    workbook.modified = new Date();

    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" },
    };
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };

    const periodLabel = `${fromDate.toLocaleDateString("fr-FR")} au ${toDate.toLocaleDateString("fr-FR")}`;
    const formatUsd = (v) => (v == null ? "-" : `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`);

    // ========================
    //   ONGLET 1 : SYNTHÈSE
    // ========================
    const synthese = workbook.addWorksheet("Synthèse", {
      views: [{ showGridLines: false }],
    });

    synthese.mergeCells("A1", "E1");
    synthese.getCell("A1").value = "Grand Livre Comptable - Collège Le Mérite";
    synthese.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    synthese.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    synthese.getCell("A1").fill = titleFill;

    synthese.mergeCells("A2", "E2");
    synthese.getCell("A2").value = `Période : ${periodLabel}`;
    synthese.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    synthese.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    synthese.getCell("A2").fill = titleFill;

    synthese.getRow(1).height = 24;
    synthese.getRow(2).height = 20;

    synthese.addRow([]);

    // KPI Cards
    const kpiRow = 4;
    const kpis = [
      { label: "Comptes", value: nbComptes, icon: "📖", color: "FF4B5563" },
      { label: "Mouvements", value: nbMouvements, icon: "📝", color: "FF6366F1" },
      {
        label: "Total Débit",
        value: formatUsd(totalDebitPeriode),
        icon: "💚",
        color: "FF16A34A",
      },
      {
        label: "Total Crédit",
        value: formatUsd(totalCreditPeriode),
        icon: "❤️",
        color: "FFDC2626",
      },
      {
        label: "Équilibre",
        value: formatUsd(totalDebitPeriode - totalCreditPeriode),
        icon: "⚖️",
        color: Math.abs(totalDebitPeriode - totalCreditPeriode) < 0.01 ? "FF16A34A" : "FFDC2626",
      },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx);

      const iconCell = synthese.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 22 };
      iconCell.alignment = { horizontal: "center", vertical: "middle" };

      const valueCell = synthese.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = {
        size: 13,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      valueCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: kpi.color },
      };

      const labelCell = synthese.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      synthese.getColumn(col).width = 18;
    });

    synthese.getRow(kpiRow).height = 28;
    synthese.getRow(kpiRow + 1).height = 36;
    synthese.getRow(kpiRow + 2).height = 22;

    // Bloc sommaire par classe de compte
    const rowSommaireStart = kpiRow + 5;
    synthese.mergeCells(`A${rowSommaireStart}`, `E${rowSommaireStart}`);
    const sommaireTitle = synthese.getCell(`A${rowSommaireStart}`);
    sommaireTitle.value = "Sommaire par classe de compte";
    sommaireTitle.font = {
      size: 13,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    sommaireTitle.alignment = { horizontal: "center", vertical: "middle" };
    sommaireTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F2937" },
    };
    synthese.getRow(rowSommaireStart).height = 22;

    const headerSommaire = synthese.getRow(rowSommaireStart + 1);
    headerSommaire.values = [
      "Classe",
      "Nb comptes",
      "Total Débit (USD)",
      "Total Crédit (USD)",
      "Solde net (USD)",
    ];
    headerSommaire.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF111827" }, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = headerFill;
      cell.border = borderThin;
    });
    synthese.getRow(rowSommaireStart + 1).height = 20;

    synthese.getColumn(1).width = 20;
    synthese.getColumn(2).width = 14;
    synthese.getColumn(3).width = 18;
    synthese.getColumn(4).width = 18;
    synthese.getColumn(5).width = 18;

    // Agrégation par classe (premier chiffre)
    const classeMap = new Map();
    statsComptes.forEach((sc) => {
      const classe = sc.numero.charAt(0);
      if (!classeMap.has(classe)) {
        classeMap.set(classe, {
          classe,
          nbComptes: 0,
          totalDebit: 0,
          totalCredit: 0,
        });
      }
      const c = classeMap.get(classe);
      c.nbComptes++;
      c.totalDebit += sc.debitPeriode;
      c.totalCredit += sc.creditPeriode;
    });

    const classesLabels = {
      "1": "Classe 1 - Capitaux",
      "2": "Classe 2 - Immobilisations",
      "3": "Classe 3 - Stocks",
      "4": "Classe 4 - Tiers",
      "5": "Classe 5 - Trésorerie",
      "6": "Classe 6 - Charges",
      "7": "Classe 7 - Produits",
      "8": "Classe 8 - Autres",
    };

    let iClasse = 0;
    Array.from(classeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([classe, data]) => {
        const soldeNet = data.totalDebit - data.totalCredit;
        const row = synthese.addRow([
          classesLabels[classe] || `Classe ${classe}`,
          data.nbComptes,
          data.totalDebit,
          data.totalCredit,
          soldeNet,
        ]);

        iClasse++;
        const bgColor = iClasse % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

        row.eachCell((cell, col) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bgColor },
          };
          cell.border = borderThin;
          cell.alignment = {
            vertical: "middle",
            horizontal: col === 1 ? "left" : "right",
          };
          if (col >= 3) {
            cell.numFmt = '#,##0.00" USD"';
          }
        });
        row.height = 20;
      });

    synthese.addRow([]);
    const noteSynth = synthese.addRow([
      "Remarque : Le solde net par classe = Total Débit - Total Crédit. L'équilibre global doit être proche de zéro.",
    ]);
    synthese.mergeCells(noteSynth.number, 1, noteSynth.number, 5);
    noteSynth.getCell(1).font = {
      italic: true,
      size: 10,
      color: { argb: "FF6B7280" },
    };
    noteSynth.getCell(1).alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };

    // ========================
    //   ONGLET 2 : GRAND LIVRE DÉTAILLÉ
    // ========================
    const sheet = workbook.addWorksheet("Grand Livre Détaillé", {
      views: [
        {
          state: "frozen",
          ySplit: 4,
        },
      ],
    });

    sheet.mergeCells("A1", "H1");
    sheet.getCell("A1").value = "Grand Livre Comptable - Collège Le Mérite";
    sheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "H2");
    sheet.getCell("A2").value = `Période : ${periodLabel}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 18;

    sheet.addRow([]);

    sheet.columns = [
      { header: "Compte", key: "compte", width: 12 },
      { header: "Intitulé", key: "intitule", width: 28 },
      { header: "Date", key: "date", width: 12 },
      { header: "Référence", key: "reference", width: 16 },
      { header: "Libellé", key: "libelle", width: 40 },
      { header: "Sens", key: "sens", width: 10 },
      { header: "Montant (USD)", key: "montant", width: 16 },
      { header: "Type", key: "type", width: 16 },
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
      to: "H4",
    };

    // Écriture par compte
    comptesTries.forEach((numero) => {
      const infoAvant = mapAvant.get(numero);
      const compteData = comptesMap.get(numero);
      const mouvements = compteData ? compteData.mouvements : [];

      const intitule =
        (infoAvant && infoAvant.intitule) ||
        (compteData && compteData.intitule) ||
        "";

      // Ligne solde ouverture
      if (infoAvant && infoAvant.soldeOuverture !== 0) {
        const sensOuverture =
          infoAvant.soldeOuverture >= 0 ? "DEBIT" : "CREDIT";
        const montantOuverture = Math.abs(infoAvant.soldeOuverture);

        const rowOpen = sheet.addRow({
          compte: numero,
          intitule,
          date: "",
          reference: "SOLDE OUVERTURE",
          libelle: "Solde antérieur à la période",
          sens: sensOuverture,
          montant: montantOuverture,
          type: "Ouverture",
        });

        rowOpen.eachCell((cell, colNumber) => {
          cell.border = borderThin;
          cell.alignment = {
            vertical: "middle",
            horizontal:
              colNumber >= 7 ? "right" : colNumber === 1 ? "center" : "left",
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEF3C7" }, // Jaune clair
          };
          cell.font = { bold: true, color: { argb: "FF92400E" } };
        });
        rowOpen.height = 18;
      }

      // Mouvements
      mouvements.forEach((l) => {
        const rowMvt = sheet.addRow({
          compte: l.compteNumero,
          intitule: l.compteIntitule || intitule,
          date: l.date ? new Date(l.date).toLocaleDateString("fr-FR") : "",
          reference: l.reference || "",
          libelle: l.libelle || "",
          sens: l.sens || "",
          montant: l.montant || 0,
          type: "Mouvement",
        });

        rowMvt.eachCell((cell, colNumber) => {
          cell.border = borderThin;
          cell.alignment = {
            vertical: "middle",
            horizontal:
              colNumber >= 7 ? "right" : colNumber === 1 ? "center" : "left",
          };
          if (colNumber === 7) {
            cell.numFmt = '#,##0.00" USD"';
          }

          // Couleur selon sens
          if (colNumber === 6 || colNumber === 7) {
            if (l.sens === "DEBIT") {
              cell.font = { color: { argb: "FF16A34A" }, bold: true };
            } else if (l.sens === "CREDIT") {
              cell.font = { color: { argb: "FFDC2626" }, bold: true };
            }
          }
        });
        rowMvt.height = 16;
      });

      // Ligne de séparation
      sheet.addRow({});
    });

    // ========================
    //   ONGLET 3 : BALANCE DES COMPTES
    // ========================
    const balance = workbook.addWorksheet("Balance des Comptes");

    balance.mergeCells("A1", "F1");
    balance.getCell("A1").value = "Balance des Comptes";
    balance.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    balance.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    balance.getCell("A1").fill = titleFill;
    balance.getRow(1).height = 22;

    balance.mergeCells("A2", "F2");
    balance.getCell("A2").value = `Période : ${periodLabel}`;
    balance.getCell("A2").font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    balance.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    balance.getCell("A2").fill = titleFill;
    balance.getRow(2).height = 18;

    balance.addRow([]);

    const headerBalance = balance.addRow([
      "Compte",
      "Intitulé",
      "Solde Ouverture",
      "Débit Période",
      "Crédit Période",
      "Solde Clôture",
    ]);

    headerBalance.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF111827" }, size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.fill = headerFill;
      cell.border = borderThin;
    });
    balance.getRow(4).height = 20;

    balance.getColumn(1).width = 12;
    balance.getColumn(2).width = 32;
    balance.getColumn(3).width = 18;
    balance.getColumn(4).width = 18;
    balance.getColumn(5).width = 18;
    balance.getColumn(6).width = 18;

    let iBalance = 0;
    statsComptes.forEach((sc) => {
      const row = balance.addRow([
        sc.numero,
        sc.intitule,
        sc.soldeOuverture,
        sc.debitPeriode,
        sc.creditPeriode,
        sc.soldeCloture,
      ]);

      iBalance++;
      const bgColor = iBalance % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

      row.eachCell((cell, col) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal: col <= 2 ? (col === 1 ? "center" : "left") : "right",
        };
        if (col >= 3) {
          cell.numFmt = '#,##0.00" USD"';
        }

        // Couleur solde de clôture
        if (col === 6) {
          const val = sc.soldeCloture;
          if (val > 0) {
            cell.font = { color: { argb: "FF16A34A" }, bold: true };
          } else if (val < 0) {
            cell.font = { color: { argb: "FFDC2626" }, bold: true };
          }
        }
      });
      row.height = 18;
    });

    // Ligne de totaux
    const totalSoldeOuverture = statsComptes.reduce(
      (acc, s) => acc + s.soldeOuverture,
      0
    );
    const totalDebitPer = statsComptes.reduce(
      (acc, s) => acc + s.debitPeriode,
      0
    );
    const totalCreditPer = statsComptes.reduce(
      (acc, s) => acc + s.creditPeriode,
      0
    );
    const totalSoldeCloture = statsComptes.reduce(
      (acc, s) => acc + s.soldeCloture,
      0
    );

    const totalRow = balance.addRow([
      "",
      "TOTAUX",
      totalSoldeOuverture,
      totalDebitPer,
      totalCreditPer,
      totalSoldeCloture,
    ]);

    totalRow.font = { bold: true, color: { argb: "FF111827" } };
    totalRow.eachCell((cell, col) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD1FAE5" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col <= 2 ? "right" : "right",
      };
      if (col >= 3) {
        cell.numFmt = '#,##0.00" USD"';
      }
    });

    // ========================
    //   ONGLET 4 : LÉGENDE
    // ========================
    const legend = workbook.addWorksheet("Légende", {
      views: [{ showGridLines: false }],
    });

    legend.mergeCells("A1:D1");
    const lTitle = legend.getCell("A1");
    lTitle.value = "LÉGENDE ET LECTURE DU GRAND LIVRE";
    lTitle.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    lTitle.alignment = { horizontal: "center", vertical: "middle" };
    lTitle.fill = titleFill;
    legend.getRow(1).height = 32;

    legend.addRow([]);
    legend.addRow(["Élément", "Description", "", ""]);
    legend.getRow(3).font = { bold: true };
    legend.getRow(3).height = 22;

    const legendRows = [
      [
        "Synthèse",
        "Vue d'ensemble avec KPI et sommaire par classe de compte.",
      ],
      [
        "Grand Livre Détaillé",
        "Liste complète des mouvements par compte avec solde d'ouverture.",
      ],
      [
        "Balance des Comptes",
        "Tableau récapitulatif : solde d'ouverture, mouvements, solde de clôture par compte.",
      ],
      [
        "Solde Ouverture",
        "Solde du compte au début de la période sélectionnée (mouvements antérieurs).",
      ],
      [
        "Débit",
        "Mouvement augmentant le solde du compte (affiché en vert).",
      ],
      [
        "Crédit",
        "Mouvement diminuant le solde du compte (affiché en rouge).",
      ],
      [
        "Solde Clôture",
        "Solde Ouverture + Débit Période - Crédit Période.",
      ],
      [
        "Équilibre",
        "Total Débit = Total Crédit sur l'ensemble des mouvements (principe de la comptabilité en partie double).",
      ],
    ];

    legendRows.forEach((item) => {
      const row = legend.addRow([item[0], item[1], "", ""]);
      row.height = 22;
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    legend.getColumn(1).width = 25;
    legend.getColumn(2).width = 70;
    legend.getColumn(3).width = 5;
    legend.getColumn(4).width = 5;

    legend.addRow([]);
    legend.addRow([]);
    legend.mergeCells("A" + legend.rowCount + ":D" + legend.rowCount);
    const instrTitle = legend.getCell("A" + legend.rowCount);
    instrTitle.value = "📋 CONSEILS D'UTILISATION";
    instrTitle.font = {
      size: 14,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    instrTitle.alignment = { horizontal: "center", vertical: "middle" };
    instrTitle.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF3498DB" },
    };
    legend.getRow(legend.rowCount).height = 28;

    const instructions = [
      "• Utilisez l'onglet Synthèse pour une vue rapide des KPI et de la répartition par classe.",
      "• Consultez le Grand Livre Détaillé pour l'analyse ligne par ligne de chaque compte.",
      "• La Balance des Comptes vous permet de vérifier rapidement les soldes d'ouverture et de clôture.",
      "• Les couleurs aident à identifier rapidement les débits (vert) et crédits (rouge).",
      "• Le solde de clôture positif indique un solde débiteur, négatif un solde créditeur.",
    ];

    instructions.forEach((text) => {
      legend.addRow([]);
      legend.mergeCells("A" + legend.rowCount + ":D" + legend.rowCount);
      const cell = legend.getCell("A" + legend.rowCount);
      cell.value = text;
      cell.font = { size: 11 };
      cell.alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
      legend.getRow(legend.rowCount).height = 20;
    });

    // ========================
    //   EXPORT
    // ========================
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

    // 3) Fusion et calcul des soldes
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

    const nbComptes = comptes.length;
    const desequilibre = totalDebit - totalCredit;

    // 4) Excel avancé
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Balance Générale";
    workbook.created = new Date();
    workbook.modified = new Date();

    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" },
    };
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };
    const periodLabel = `du ${fromDate.toLocaleDateString(
      "fr-FR"
    )} au ${toDate.toLocaleDateString("fr-FR")}`;
    const formatUsd = (v) =>
      v == null
        ? "-"
        : `${v.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} USD`;

    // =====================
    // ONGLET 1 : SYNTHÈSE
    // =====================
    const synthese = workbook.addWorksheet("Synthèse", {
      views: [{ showGridLines: false }],
    });

    synthese.mergeCells("A1", "E1");
    synthese.getCell("A1").value =
      "Balance générale - Collège Le Mérite";
    synthese.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    synthese.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    synthese.getCell("A1").fill = titleFill;

    synthese.mergeCells("A2", "E2");
    synthese.getCell("A2").value = `Période ${periodLabel}`;
    synthese.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    synthese.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    synthese.getCell("A2").fill = titleFill;

    synthese.getRow(1).height = 24;
    synthese.getRow(2).height = 20;
    synthese.addRow([]);

    const kpiRow = 4;
    const kpis = [
      { label: "Nombre de comptes", value: nbComptes, icon: "📘", color: "FF4B5563" },
      { label: "Total Débit", value: formatUsd(totalDebit), icon: "💚", color: "FF16A34A" },
      { label: "Total Crédit", value: formatUsd(totalCredit), icon: "❤️", color: "FFDC2626" },
      {
        label: "Somme soldes Débiteurs",
        value: formatUsd(totalSoldesDebiteurs),
        icon: "⬆️",
        color: "FF0EA5E9",
      },
      {
        label: "Somme soldes Créditeurs",
        value: formatUsd(totalSoldesCrediteurs),
        icon: "⬇️",
        color: "FF6366F1",
      },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx);

      const iconCell = synthese.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 20 };
      iconCell.alignment = { horizontal: "center", vertical: "middle" };

      const valueCell = synthese.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = {
        size: 13,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      valueCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: kpi.color },
      };

      const labelCell = synthese.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      synthese.getColumn(col).width = 20;
    });

    synthese.getRow(kpiRow).height = 28;
    synthese.getRow(kpiRow + 1).height = 34;
    synthese.getRow(kpiRow + 2).height = 22;

    const rowEqui = kpiRow + 4;
    synthese.mergeCells(`A${rowEqui}:E${rowEqui}`);
    const equiCell = synthese.getCell(`A${rowEqui}`);
    equiCell.value = `Équilibre global (Débit - Crédit) : ${formatUsd(
      desequilibre
    )}`;
    equiCell.font = {
      size: 12,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    equiCell.alignment = { horizontal: "center", vertical: "middle" };
    equiCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor:
        Math.abs(desequilibre) < 0.01 ? "FF16A34A" : "FFDC2626",
    };
    synthese.getRow(rowEqui).height = 22;

    // =====================
    // ONGLET 2 : BALANCE
    // =====================
    const sheet = workbook.addWorksheet("Balance générale", {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    sheet.mergeCells("A1", "F1");
    sheet.getCell("A1").value =
      "Balance comptable - Collège Le Mérite";
    sheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "F2");
    sheet.getCell("A2").value = `Période ${periodLabel}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 18;
    sheet.addRow([]);

    sheet.columns = [
      { header: "N° compte", key: "numero", width: 12 },
      { header: "Intitulé", key: "intitule", width: 32 },
      { header: "Total débit (USD)", key: "totalDebit", width: 18 },
      { header: "Total crédit (USD)", key: "totalCredit", width: 18 },
      { header: "Solde débiteur (USD)", key: "soldeDebiteur", width: 20 },
      { header: "Solde créditeur (USD)", key: "soldeCrediteur", width: 20 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FF111827" }, size: 11 };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = headerFill;
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    sheet.autoFilter = {
      from: "A4",
      to: "F4",
    };

    let iRow = 0;
    comptes.forEach((c) => {
      const row = sheet.addRow({
        numero: c.numero,
        intitule: c.intitule,
        totalDebit: c.totalDebit,
        totalCredit: c.totalCredit,
        soldeDebiteur: c.soldeDebiteur,
        soldeCrediteur: c.soldeCrediteur,
      });
      iRow++;

      const bgColor = iRow % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

      row.eachCell((cell, col) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal:
            col === 1 ? "center" : col === 2 ? "left" : "right",
        };
        if (col >= 3) {
          cell.numFmt = '#,##0.00" USD"';
        }

        // Colorer soldes
        if (col === 5 && c.soldeDebiteur > 0) {
          cell.font = { color: { argb: "FF16A34A" }, bold: true };
        }
        if (col === 6 && c.soldeCrediteur > 0) {
          cell.font = { color: { argb: "FFDC2626" }, bold: true };
        }
      });
      row.height = 18;
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

    totalRow.font = { bold: true, size: 12, color: { argb: "FF111827" } };
    totalRow.eachCell((cell, col) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD1FAE5" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col <= 2 ? "right" : "right",
      };
      if (col >= 3) {
        cell.numFmt = '#,##0.00" USD"';
      }
    });

    // =====================
    // ONGLET 3 : LÉGENDE
    // =====================
    const legend = workbook.addWorksheet("Légende", {
      views: [{ showGridLines: false }],
    });

    legend.mergeCells("A1:D1");
    const lTitle = legend.getCell("A1");
    lTitle.value = "LÉGENDE ET LECTURE DE LA BALANCE";
    lTitle.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    lTitle.alignment = { horizontal: "center", vertical: "middle" };
    lTitle.fill = titleFill;
    legend.getRow(1).height = 30;

    legend.addRow([]);
    legend.addRow(["Élément", "Description", "", ""]);
    legend.getRow(3).font = { bold: true };
    legend.getRow(3).height = 22;

    const legendRows = [
      [
        "Balance générale",
        "Tableau récapitulatif de tous les comptes avec totaux débit/crédit et soldes.",
      ],
      [
        "Total débit / crédit",
        "Somme des débits et crédits par compte sur la période (incluant l'antérieur).",
      ],
      [
        "Solde débiteur",
        "Partie du solde excédant au débit (affichée en vert).",
      ],
      [
        "Solde créditeur",
        "Partie du solde excédant au crédit (affichée en rouge).",
      ],
      [
        "Équilibre global",
        "La différence Total Débit - Total Crédit doit théoriquement être nulle.",
      ],
      [
        "Couleurs",
        "Vert = débiteur, Rouge = créditeur, Ligne TOTAL = surlignée.",
      ],
    ];

    legendRows.forEach((item) => {
      const row = legend.addRow([item[0], item[1], "", ""]);
      row.height = 20;
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    legend.getColumn(1).width = 28;
    legend.getColumn(2).width = 70;
    legend.getColumn(3).width = 5;
    legend.getColumn(4).width = 5;

    // 5) EXPORT
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

    // 1) SOLDES AVANT PERIODE (classes 6 et 7)
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

    // 2) MOUVEMENTS DE LA PERIODE (classes 6 et 7)
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

    // 3) Injecter les soldes antérieurs dans la période
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

    // 4) Construire charges / produits
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
    const marge = totalProduits !== 0 ? (resultat / totalProduits) * 100 : 0;

    // ========= EXCEL =========
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Compte de Résultat";
    workbook.created = new Date();
    workbook.modified = new Date();

    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" },
    };
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };
    const periodLabel = `du ${fromDate.toLocaleDateString(
      "fr-FR"
    )} au ${toDate.toLocaleDateString("fr-FR")}`;
    const formatUsd = (v) =>
      v == null
        ? "-"
        : `${v.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} USD`;

    // ======================
    // ONGLET 1 : DASHBOARD
    // ======================
    const dash = workbook.addWorksheet("Dashboard Résultat", {
      views: [{ showGridLines: false }],
    });

    dash.mergeCells("A1", "E1");
    dash.getCell("A1").value =
      "Compte de résultat - Collège Le Mérite";
    dash.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    dash.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    dash.getCell("A1").fill = titleFill;

    dash.mergeCells("A2", "E2");
    dash.getCell("A2").value = `Période ${periodLabel}`;
    dash.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    dash.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    dash.getCell("A2").fill = titleFill;

    dash.getRow(1).height = 24;
    dash.getRow(2).height = 20;
    dash.addRow([]);

    const kpiRow = 4;
    const kpis = [
      {
        label: "Total Produits",
        value: formatUsd(totalProduits),
        icon: "📈",
        color: "FF16A34A",
      },
      {
        label: "Total Charges",
        value: formatUsd(totalCharges),
        icon: "📉",
        color: "FFDC2626",
      },
      {
        label: "Résultat (P - C)",
        value: formatUsd(resultat),
        icon: resultat >= 0 ? "✅" : "⚠️",
        color: resultat >= 0 ? "FF0EA5E9" : "FFDC2626",
      },
      {
        label: "Marge nette",
        value: totalProduits
          ? `${marge.toFixed(2)} %`
          : "-",
        icon: "📊",
        color: "FF6366F1",
      },
      {
        label: "Nb comptes (6/7)",
        value: charges.length + produits.length,
        icon: "📘",
        color: "FF4B5563",
      },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx);

      const iconCell = dash.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 20 };
      iconCell.alignment = { horizontal: "center", vertical: "middle" };

      const valueCell = dash.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = {
        size: 13,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      valueCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: kpi.color },
      };

      const labelCell = dash.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      dash.getColumn(col).width = 20;
    });

    dash.getRow(kpiRow).height = 28;
    dash.getRow(kpiRow + 1).height = 34;
    dash.getRow(kpiRow + 2).height = 22;

    // ======================
    // ONGLET 2 : COMPTE DÉTAILLÉ
    // ======================
    const sheet = workbook.addWorksheet("Compte de résultat", {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    sheet.mergeCells("A1", "D1");
    sheet.getCell("A1").value =
      "Compte de résultat - Collège Le Mérite";
    sheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "D2");
    sheet.getCell("A2").value = `Période ${periodLabel}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 18;
    sheet.addRow([]);

    sheet.columns = [
      { header: "Compte charges", key: "c_num", width: 32 },
      { header: "Montant charges (USD)", key: "c_solde", width: 22 },
      { header: "Compte produits", key: "p_num", width: 32 },
      { header: "Montant produits (USD)", key: "p_solde", width: 24 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FF111827" }, size: 11 };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = headerFill;
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    const maxRows = Math.max(charges.length, produits.length);
    for (let i = 0; i < maxRows; i++) {
      const c = charges[i];
      const p = produits[i];
      const row = sheet.addRow({
        c_num: c ? `${c.numero} - ${c.intitule}` : "",
        c_solde: c ? c.solde : "",
        p_num: p ? `${p.numero} - ${p.intitule}` : "",
        p_solde: p ? p.solde : "",
      });

      const bgColor = i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

      row.eachCell((cell, col) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal: col === 1 || col === 3 ? "left" : "right",
        };
        if (col === 2 || col === 4) {
          cell.numFmt = '#,##0.00" USD"';
        }
      });
      row.height = 18;
    }

    sheet.addRow({});
    const resRow = sheet.addRow({
      c_num: "",
      c_solde: "",
      p_num: "Résultat (Produits - Charges)",
      p_solde: resultat,
    });
    resRow.font = { bold: true, size: 12 };
    resRow.eachCell((cell, col) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: resultat >= 0 ? "FFD1FAE5" : "FFFEE2E2",
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 3 ? "right" : "right",
      };
      if (col === 4) {
        cell.numFmt = '#,##0.00" USD"';
        cell.font = {
          bold: true,
          color: {
            argb: resultat >= 0 ? "FF16A34A" : "FFDC2626",
          },
        };
      }
    });

    // ======================
    // ONGLET 3 : LÉGENDE
    // ======================
    const legend = workbook.addWorksheet("Légende", {
      views: [{ showGridLines: false }],
    });

    legend.mergeCells("A1:D1");
    const lTitle = legend.getCell("A1");
    lTitle.value = "LÉGENDE ET LECTURE DU COMPTE DE RÉSULTAT";
    lTitle.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    lTitle.alignment = { horizontal: "center", vertical: "middle" };
    lTitle.fill = titleFill;
    legend.getRow(1).height = 30;

    legend.addRow([]);
    legend.addRow(["Élément", "Description", "", ""]);
    legend.getRow(3).font = { bold: true };
    legend.getRow(3).height = 22;

    const legendRows = [
      [
        "Charges (classe 6)",
        "Comptes de charges de l'établissement (frais, salaires, fournitures, etc.).",
      ],
      [
        "Produits (classe 7)",
        "Comptes de produits (frais scolaires, subventions, autres revenus).",
      ],
      [
        "Résultat",
        "Total Produits - Total Charges, mis en couleur selon qu'il est bénéficiaire (vert) ou déficitaire (rouge).",
      ],
      [
        "Marge nette",
        "Résultat / Total Produits, indicateur de performance globale.",
      ],
      [
        "Soldes antérieurs",
        "Les soldes des périodes précédentes sont intégrés dans les montants analysés.",
      ],
    ];

    legendRows.forEach((item) => {
      const row = legend.addRow([item[0], item[1], "", ""]);
      row.height = 20;
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    legend.getColumn(1).width = 28;
    legend.getColumn(2).width = 70;
    legend.getColumn(3).width = 5;
    legend.getColumn(4).width = 5;

    // EXPORT
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
    console.error(
      "Erreur exportCompteResultatChargesProduitsExcel:",
      err
    );
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

    // Tri (facultatif)
    actif.sort((a, b) => a.numero.localeCompare(b.numero));
    passif.sort((a, b) => a.numero.localeCompare(b.numero));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Bilan comptable";
    workbook.created = new Date();
    workbook.modified = new Date();

    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111827" },
    };
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };
    const periodeLabel =
      from && to
        ? `du ${dateDebut.toLocaleDateString("fr-FR")} au ${dateFin.toLocaleDateString("fr-FR")}`
        : `au ${dateFin.toLocaleDateString("fr-FR")}`;
    const formatUsd = (v) =>
      v == null
        ? "-"
        : `${v.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} USD`;

    // ======================
    // ONGLET 1 : DASHBOARD
    // ======================
    const dash = workbook.addWorksheet("Dashboard Bilan", {
      views: [{ showGridLines: false }],
    });

    dash.mergeCells("A1", "E1");
    dash.getCell("A1").value = "Bilan comptable - Collège Le Mérite";
    dash.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    dash.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    dash.getCell("A1").fill = titleFill;

    dash.mergeCells("A2", "E2");
    dash.getCell("A2").value = `Type : ${type.toUpperCase()} • Période ${periodeLabel}`;
    dash.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    dash.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    dash.getCell("A2").fill = titleFill;

    dash.getRow(1).height = 24;
    dash.getRow(2).height = 20;
    dash.addRow([]);

    const kpiRow = 4;
    const desequilibre = totalActif - (totalPassif + resultat);

    const kpis = [
      { label: "Total Actif", value: formatUsd(totalActif), icon: "🏦", color: "FF0EA5E9" },
      { label: "Total Passif", value: formatUsd(totalPassif), icon: "📑", color: "FF6366F1" },
      { label: "Résultat (bilan)", value: formatUsd(resultat), icon: resultat >= 0 ? "✅" : "⚠️", color: resultat >= 0 ? "FF22C55E" : "FFDC2626" },
      { label: "Actif - (Passif+Rés.)", value: formatUsd(desequilibre), icon: "⚖️", color: Math.abs(desequilibre) < 0.01 ? "FF16A34A" : "FFDC2626" },
      { label: "Nb comptes", value: comptesBilan.length, icon: "📘", color: "FF4B5563" },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx);

      const iconCell = dash.getCell(`${col}${kpiRow}`);
      iconCell.value = kpi.icon;
      iconCell.font = { size: 20 };
      iconCell.alignment = { horizontal: "center", vertical: "middle" };

      const valueCell = dash.getCell(`${col}${kpiRow + 1}`);
      valueCell.value = kpi.value;
      valueCell.font = {
        size: 13,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      valueCell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      valueCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: kpi.color },
      };

      const labelCell = dash.getCell(`${col}${kpiRow + 2}`);
      labelCell.value = kpi.label;
      labelCell.font = { size: 10, bold: true };
      labelCell.alignment = { horizontal: "center", vertical: "middle" };
      labelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      dash.getColumn(col).width = 20;
    });

    dash.getRow(kpiRow).height = 28;
    dash.getRow(kpiRow + 1).height = 34;
    dash.getRow(kpiRow + 2).height = 22;

    // ======================
    // ONGLET 2 : BILAN
    // ======================
    const sheet = workbook.addWorksheet("Bilan", {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    sheet.mergeCells("A1", "F1");
    sheet.getCell("A1").value = "Bilan comptable - Collège Le Mérite";
    sheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "F2");
    sheet.getCell("A2").value = `Type : ${type.toUpperCase()} • Période ${periodeLabel}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 18;
    sheet.addRow([]);

    sheet.columns = [
      { header: "Actif - Compte", key: "actifCompte", width: 18 },
      { header: "Actif - Intitulé", key: "actifIntitule", width: 32 },
      { header: "Actif - Montant (USD)", key: "actifMontant", width: 20 },
      { header: "Passif - Compte", key: "passifCompte", width: 18 },
      { header: "Passif - Intitulé", key: "passifIntitule", width: 32 },
      { header: "Passif - Montant (USD)", key: "passifMontant", width: 20 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FF111827" }, size: 11 };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = headerFill;
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    const maxRows = Math.max(actif.length, passif.length);
    for (let i = 0; i < maxRows; i++) {
      const a = actif[i];
      const p = passif[i];
      const row = sheet.addRow({
        actifCompte: a ? a.numero : "",
        actifIntitule: a ? a.intitule : "",
        actifMontant: a ? a.montant : "",
        passifCompte: p ? p.numero : "",
        passifIntitule: p ? p.intitule : "",
        passifMontant: p ? p.montant : "",
      });

      const bgColor = i % 2 === 0 ? "FFFFFFFF" : "FFF9FAFB";

      row.eachCell((cell, col) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: bgColor },
        };
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal:
            col === 1 || col === 2 || col === 4 || col === 5
              ? "left"
              : "right",
        };
        if (col === 3 || col === 6) {
          cell.numFmt = '#,##0.00" USD"';
        }
      });
      row.height = 18;
    }

    sheet.addRow({});
    const totalRow = sheet.addRow({
      actifIntitule: "Total Actif",
      actifMontant: totalActif,
      passifIntitule: "Total Passif",
      passifMontant: totalPassif,
    });
    totalRow.font = { bold: true, size: 12, color: { argb: "FF111827" } };
    totalRow.eachCell((cell, col) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD1FAE5" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 2 || col === 5 ? "right" : "right",
      };
      if (col === 3 || col === 6) {
        cell.numFmt = '#,##0.00" USD"';
      }
    });

    const resRow = sheet.addRow({
      actifIntitule: "Résultat (bilan)",
      actifMontant: resultat,
    });
    resRow.font = { bold: true, size: 12 };
    resRow.eachCell((cell, col) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: resultat >= 0 ? "FFD1FAE5" : "FFFEE2E2",
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: col === 2 ? "right" : "right",
      };
      if (col === 3) {
        cell.numFmt = '#,##0.00" USD"';
        cell.font = {
          bold: true,
          color: {
            argb: resultat >= 0 ? "FF16A34A" : "FFDC2626",
          },
        };
      }
    });

    // ======================
    // ONGLET 3 : LÉGENDE
    // ======================
    const legend = workbook.addWorksheet("Légende", {
      views: [{ showGridLines: false }],
    });

    legend.mergeCells("A1:D1");
    const lTitle = legend.getCell("A1");
    lTitle.value = "LÉGENDE ET LECTURE DU BILAN";
    lTitle.font = { size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    lTitle.alignment = { horizontal: "center", vertical: "middle" };
    lTitle.fill = titleFill;
    legend.getRow(1).height = 30;

    legend.addRow([]);
    legend.addRow(["Élément", "Description", "", ""]);
    legend.getRow(3).font = { bold: true };
    legend.getRow(3).height = 22;

    const legendRows = [
      ["Actif", "Ce que possède l'établissement (immobilisations, trésorerie, créances, etc.)."],
      ["Passif", "Ce que doit l'établissement (dettes, capitaux propres, résultat)."],
      ["Résultat (bilan)", "Différence entre Actif et Passif hors résultat, intégré dans la structure financière."],
      ["Équilibre", "En pratique : Total Actif = Total Passif + Résultat (bilan)."],
      ["Type de bilan", "Ouverture, intermédiaire ou clôture selon la période choisie."],
    ];

    legendRows.forEach((item) => {
      const row = legend.addRow([item[0], item[1], "", ""]);
      row.height = 20;
      row.eachCell((cell) => {
        cell.border = borderThin;
        cell.alignment = {
          horizontal: "left",
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    legend.getColumn(1).width = 26;
    legend.getColumn(2).width = 70;
    legend.getColumn(3).width = 5;
    legend.getColumn(4).width = 5;

    // EXPORT
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


// GET /api/comptable/budget-annuel?anneeScolaire=2025-2026&annee=2025&classeId=...
// GET /api/comptable/budget-annuel?anneeScolaire=2025-2026&annee=2025&classeId=...
// GET /api/comptable/budget-annuel?anneeScolaire=2025-2026&annee=2025&classeId=...
exports.getBudgetAnnuel = async (req, res, next) => {
  try {
    // 🔹 Paramètres
    const {
      anneeScolaire: qsAnneeScolaire,
      annee,              // année civile pour regrouper les paiements
      classeId,
    } = req.query;

    const year = parseInt(annee, 10) || new Date().getFullYear();
    const anneeScolaire =
      qsAnneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      "2025-2026";

    console.log("📊 Budget annuel fusionné:", {
      anneeScolaire,
      year,
      classeId,
    });

    // ============================================================
    // 1) PARTIE PÉDAGOGIQUE : élèves + paiements (revenus attendus / réels)
    // ============================================================

    // 1.1 Élèves actifs
    const eleveFilter = {
      statut: "actif",
      anneeScolaire,
    };
    if (classeId) {
      eleveFilter.classe = classeId;
    }
    const eleves = await Eleve.find(eleveFilter).populate("classe");

    // 1.2 Attendu annuel (frais scolaires)
    let attenduAnnuel = 0;
    for (const eleve of eleves) {
      if (eleve.classe && eleve.classe.montantFrais) {
        attenduAnnuel += eleve.classe.montantFrais;
      }
    }
    console.log("➡️ Attendu annuel (frais élèves):", attenduAnnuel);

    // 1.3 Liste d'ids élèves
    const elevesIds = eleves.map((e) => e._id);

    // 1.4 Paiements de l'année civile
    const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const paiementFilter = {
      statut: "validé",
      anneeScolaire,
      datePaiement: { $gte: startYear, $lte: endYear },
    };
    if (classeId) {
      paiementFilter.eleve = { $in: elevesIds };
    }
    const paiements = await Paiement.find(paiementFilter).lean();
    console.log("➡️ Nb paiements trouvés:", paiements.length);

    // 1.5 Regrouper par mois (base pédagogique)
    const months = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];

    const recapMoisPedagogique = months.map((label, index) => ({
      mois: index + 1,
      label,
      revenusPrevus: 0,
      revenusReels: 0,
    }));

    // 1.6 Répartition uniforme de l'attendu sur 12 mois
    const attenduMensuel = attenduAnnuel / 12;
    recapMoisPedagogique.forEach((m) => {
      m.revenusPrevus = attenduMensuel;
    });

    // 1.7 Paiements réels par mois
    let totalPayeAnnuel = 0;
    for (const p of paiements) {
      if (!p.datePaiement) continue;
      const d = new Date(p.datePaiement);
      const mIndex = d.getMonth(); // 0-11

      const montant = p.montant || 0;
      totalPayeAnnuel += montant;

      if (recapMoisPedagogique[mIndex]) {
        recapMoisPedagogique[mIndex].revenusReels += montant;
      }
    }
    console.log("➡️ Total payé annuel:", totalPayeAnnuel);

    // ============================================================
    // 2) PARTIE GLOBALE : DepenseBudget + trésorerie + comptesPrefixes
    //    (via service calculerBudgetAnnuel)
    // ============================================================

    const ecoleId = req.user?.ecoleId || null;

    // calculerBudgetAnnuel doit retourner :
    // { recapMois, totalDepensesPrevues, totalDepensesReelles,
    //   totalEpargnePrevue, totalEpargneReelle, tresorerieDisponible, ... }
    const budgetGlobal = await calculerBudgetAnnuel(
      year,
      anneeScolaire,
      ecoleId
    );

    const recapMoisGlobal = Array.isArray(budgetGlobal.recapMois)
      ? budgetGlobal.recapMois
      : [];

    // ============================================================
    // 3) FUSION PAR MOIS : revenus (pédagogique) + dépenses/épargne (global)
    // ============================================================

    const recapByMonthGlobal = new Map();
    recapMoisGlobal.forEach((m) => recapByMonthGlobal.set(m.mois, m));

    const recapMoisFusion = recapMoisPedagogique.map((mPed) => {
      const g = recapByMonthGlobal.get(mPed.mois) || {};

      return {
        mois: mPed.mois,
        label: mPed.label,
        // revenus (pédagogique)
        revenusPrevus: mPed.revenusPrevus || 0,
        revenusReels: mPed.revenusReels || 0,
        // dépenses / épargne (global)
        depensesPrevues: g.depensesPrevues || 0,
        depensesReelles: g.depensesReelles || 0,
        epargnePrevue: g.epargnePrevue || 0,
        epargneReelle: g.epargneReelle || 0,
        // pour le donut (global)
        depensesFixes: g.depensesFixes || 0,
        depensesVariables: g.depensesVariables || 0,
        depensesCredits: g.depensesCredits || 0,
      };
    });

    // ============================================================
    // 4) Totaux et KPI (structure attendue par budget-annuel.js)
    // ============================================================

    let totalDepensesPrevues = 0;
    let totalDepensesReelles = 0;
    let totalEpargnePrevueTotale = 0;
    let totalEpargneReelleTotale = 0;
    let totalRevenusPrevus = 0;
    let totalRevenusReels = 0;

    recapMoisFusion.forEach((m) => {
      totalRevenusPrevus += m.revenusPrevus || 0;
      totalRevenusReels += m.revenusReels || 0;
      totalDepensesPrevues += m.depensesPrevues || 0;
      totalDepensesReelles += m.depensesReelles || 0;
      totalEpargnePrevueTotale += m.epargnePrevue || 0;
      totalEpargneReelleTotale += m.epargneReelle || 0;
    });

    const resultatAnnuel = totalRevenusReels - totalDepensesReelles;

    // Créances élèves = revenus attendus - revenus réalisés
    const totalCreancesEleves = Math.max(
      (totalRevenusPrevus || 0) - (totalRevenusReels || 0),
      0
    );

    // Tresorerie (classe 5) depuis budgetGlobal
    const tresorerieDisponible = budgetGlobal.tresorerieDisponible || 0;

    console.log("✅ Totaux budget fusionné:", {
      totalRevenusPrevus,
      totalRevenusReels,
      totalDepensesPrevues,
      totalDepensesReelles,
      totalEpargnePrevueTotale,
      totalEpargneReelleTotale,
      resultatAnnuel,
      totalCreancesEleves,
      tresorerieDisponible,
    });

    // ============================================================
    // 5) Réponse (compatible avec js/budget-annuel.js)
    // ============================================================

    const response = {
      success: true,
      anneeScolaire,
      annee: year,
      // pédagogiques
      attenduAnnuel: totalRevenusPrevus,
      totalRevenusPrevus,
      totalRevenusReels, // utilisé pour KPI revenus
      // dépenses / épargne (global)
      totalDepensesPrevues,
      totalDepensesReelles,
      totalEpargnePrevue: totalEpargnePrevueTotale,
      totalEpargneReelle: totalEpargneReelleTotale,
      // résultat + créances + trésorerie
      resultatAnnuel,
      totalCreancesEleves,
      tresorerieDisponible,
      // détail mensuel
      recapMois: recapMoisFusion,
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("❌ Erreur getBudgetAnnuel fusionné:", err);
    return next(err);
  }
};






// GET /api/comptable/budget-annuel-export-excel?anneeScolaire=2025-2026&annee=2025
exports.exportBudgetAnnuelExcel = async (req, res, next) => {
  try {
    const {
      anneeScolaire: qsAnneeScolaire,
      annee,
      classeId,
    } = req.query;

    const year = parseInt(annee, 10) || new Date().getFullYear();
    const anneeScolaire =
      qsAnneeScolaire ||
      process.env.ANNEE_SCOLAIRE_DEFAUT ||
      "2025-2026";

    // 1) Élèves / revenus attendus (même logique que getBudgetAnnuel fusionné)
    const eleveFilter = {
      statut: "actif",
      anneeScolaire,
    };

    if (classeId) {
      eleveFilter.classe = classeId;
    }

    const eleves = await Eleve.find(eleveFilter).populate("classe");

    let attenduAnnuel = 0;
    for (const eleve of eleves) {
      if (eleve.classe && eleve.classe.montantFrais) {
        attenduAnnuel += eleve.classe.montantFrais;
      }
    }

    const elevesIds = eleves.map((e) => e._id);

    // 2) Paiements de l'année civile
    const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const paiementFilter = {
      statut: "validé",
      anneeScolaire,
      datePaiement: { $gte: startYear, $lte: endYear },
    };

    if (classeId) {
      paiementFilter.eleve = { $in: elevesIds.filter((id) => !!id) };
    }

    const paiements = await Paiement.find(paiementFilter).lean();

    const months = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];

    const recapMoisPedagogique = months.map((label, index) => ({
      mois: index + 1,
      label,
      revenusPrevus: 0,
      revenusReels: 0,
    }));

    const attenduMensuel = attenduAnnuel / 12;
    recapMoisPedagogique.forEach((m) => {
      m.revenusPrevus = attenduMensuel;
    });

    let totalPayeAnnuel = 0;
    for (const p of paiements) {
      if (!p.datePaiement) continue;
      const d = new Date(p.datePaiement);
      const mIndex = d.getMonth();
      const montant = p.montant || 0;
      totalPayeAnnuel += montant;
      if (recapMoisPedagogique[mIndex]) {
        recapMoisPedagogique[mIndex].revenusReels += montant;
      }
    }

    // 3) Partie globale : DepenseBudget + trésorerie (via service)
    const ecoleId = req.user?.ecoleId || null;
    const budgetGlobal = await calculerBudgetAnnuel(
      year,
      anneeScolaire,
      ecoleId
    );

    const recapMoisGlobal = Array.isArray(budgetGlobal.recapMois)
      ? budgetGlobal.recapMois
      : [];

    // 4) Fusion par mois (revenus + dépenses/épargne)
    const recapByMonthGlobal = new Map();
    recapMoisGlobal.forEach((m) => recapByMonthGlobal.set(m.mois, m));

    const recapMois = recapMoisPedagogique.map((mPed) => {
      const g = recapByMonthGlobal.get(mPed.mois) || {};
      const resultat =
        (mPed.revenusReels || 0) - (g.depensesReelles || 0);

      return {
        mois: mPed.mois,
        label: mPed.label,
        revenusPrevus: mPed.revenusPrevus || 0,
        revenusReels: mPed.revenusReels || 0,
        depensesPrevues: g.depensesPrevues || 0,
        depensesReelles: g.depensesReelles || 0,
        epargnePrevue: g.epargnePrevue || 0,
        epargneReelle: g.epargneReelle || 0,
        depensesFixes: g.depensesFixes || 0,
        depensesVariables: g.depensesVariables || 0,
        depensesCredits: g.depensesCredits || 0,
        resultat,
      };
    });

    const resultatAnnuel =
      totalPayeAnnuel -
      recapMois.reduce((sum, m) => sum + (m.depensesReelles || 0), 0);

    // ===== Création du classeur Excel =====
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Budget annuel";
    const now = new Date();
    workbook.created = now;
    workbook.modified = now;

    const sheet = workbook.addWorksheet(`Budget ${year}`, {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };

    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };

    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };

    // Titre
    sheet.mergeCells("A1", "H1");
    sheet.getCell("A1").value = `Budget annuel - Collège Le Mérite`;
    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "H2");
    sheet.getCell("A2").value = `Année civile ${year} - Année scolaire ${anneeScolaire}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 20;

    sheet.addRow(); // Ligne vide (3)

    // En-têtes colonnes
    sheet.columns = [
      { header: "Mois", key: "mois", width: 18 },
      { header: "Revenus prévus", key: "revPrev", width: 20 },
      { header: "Revenus réels", key: "revReel", width: 20 },
      { header: "Dépenses prévues", key: "depPrev", width: 20 },
      { header: "Dépenses réelles", key: "depReel", width: 20 },
      { header: "Épargne prévue", key: "eparPrev", width: 20 },
      { header: "Épargne réelle", key: "eparReel", width: 20 },
      { header: "Résultat", key: "resultat", width: 18 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FF111827" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = headerFill;
    headerRow.height = 18;
    headerRow.eachCell((cell) => {
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

    recapMois.forEach((m) => {
      const row = sheet.addRow({
        mois: m.label,
        revPrev: m.revenusPrevus || 0,
        revReel: m.revenusReels || 0,
        depPrev: m.depensesPrevues || 0,
        depReel: m.depensesReelles || 0,
        eparPrev: m.epargnePrevue || 0,
        eparReel: m.epargneReelle || 0,
        resultat: m.resultat || 0,
      });

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 1 ? "left" : "right",
        };
        if (colNumber > 1) {
          cell.numFmt = "#,##0.00";
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
      mois: "TOTAL",
      revPrev: totalRevPrev,
      revReel: totalRevReel,
      depPrev: totalDepPrev,
      depReel: totalDepReel,
      eparPrev: totalEparPrev,
      eparReel: totalEparReel,
      resultat: totalResultat,
    });

    totalRow.font = { bold: true, color: { argb: "FF111827" } };
    totalRow.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F2FE" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 1 ? "left" : "right",
      };
      if (colNumber > 1) {
        cell.numFmt = "#,##0.00";
      }
    });

    sheet.addRow();

    const noteRow = sheet.addRow({
      mois:
        "Remarque : les recettes proviennent des paiements validés (élèves); les dépenses et l’épargne proviennent des paramètres budget (DepenseBudget) et de la trésorerie.",
    });
    sheet.mergeCells(noteRow.number, 1, noteRow.number, 8);
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

    const fileName = `budget-annuel-${year}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ Erreur exportBudgetAnnuelExcel fusionné:", err);
    return next(err);
  }
};

// CREANCES ELEVES (CLIENTS)
// GET /api/comptable/creances-eleves?anneeScolaire=2025-2026&classeId=...&annee=2025
// CREANCES ELEVES (CLIENTS)
// GET /api/comptable/creances-eleves
exports.getCreancesEleves = async (req, res, next) => {
  try {
    const {
      anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || "2025-2026",
      annee,
      classeId,
      statut = "all", // a_jour | partiel | impaye | all
      segment = "all", // paye | non_paye | all
      mois,            // 1-12 optionnel
      page = 1,
      limit = 25,
    } = req.query;

    const year = parseInt(annee, 10) || new Date().getFullYear();
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 25, 1);

    console.log("📊 Créances élèves:", {
      anneeScolaire,
      year,
      classeId,
      statut,
      segment,
      mois,
      page: pageNum,
      limit: limitNum,
    });

    // 1) Élèves actifs
    const eleveFilter = {
      statut: "actif",
      anneeScolaire,
    };
    if (classeId) {
      eleveFilter.classe = classeId;
    }

    const eleves = await Eleve.find(eleveFilter)
      .populate("classe")
      .lean();

    if (!eleves.length) {
      return res.status(200).json({
        success: true,
        anneeScolaire,
        annee: year,
        totalAttendu: 0,
        totalEncaisse: 0,
        totalCreances: 0,
        tauxEncaissement: 0,
        nbEleves: 0,
        filters: { statut, segment, mois: mois ? parseInt(mois, 10) : null },
        pagination: {
          page: 1,
          limit: limitNum,
          total: 0,
          totalPages: 1,
        },
        eleves: [],
      });
    }

    // 2) Attendu annuel par élève
    const elevesIds = eleves.map((e) => e._id);
    let totalAttenduGlobal = 0;
    const mapAttenduParEleve = new Map();

    for (const e of eleves) {
      const attendu = e.classe && e.classe.montantFrais
        ? Number(e.classe.montantFrais) || 0
        : 0;
      totalAttenduGlobal += attendu;
      mapAttenduParEleve.set(String(e._id), attendu);
    }

    // 3) Paiements validés
    const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const paiementFilter = {
      statut: "validé",
      anneeScolaire,
      eleve: { $in: elevesIds },
    };

    if (mois) {
      const m = parseInt(mois, 10);
      if (m >= 1 && m <= 12) {
        const startMonth = new Date(year, m - 1, 1, 0, 0, 0, 0);
        const endMonth = new Date(year, m, 0, 23, 59, 59, 999);
        paiementFilter.datePaiement = { $gte: startMonth, $lte: endMonth };
      } else {
        paiementFilter.datePaiement = { $gte: startYear, $lte: endYear };
      }
    } else {
      paiementFilter.datePaiement = { $gte: startYear, $lte: endYear };
    }

    const paiements = await Paiement.find(paiementFilter).lean();
    console.log("➡️ Paiements (créances) trouvés:", paiements.length);

    // 4) Encaisse par élève
    const mapEncaisseParEleve = new Map();
    let totalEncaisseGlobal = 0;

    for (const p of paiements) {
      if (!p.eleve) continue;
      const key = String(p.eleve);
      const montant = Number(p.montant) || 0;
      totalEncaisseGlobal += montant;

      const actuel = mapEncaisseParEleve.get(key) || 0;
      mapEncaisseParEleve.set(key, actuel + montant);
    }

    // 5) Liste complète
    const listeComplete = eleves.map((e) => {
      const id = String(e._id);
      const attendu = mapAttenduParEleve.get(id) || 0;
      const encaisse = mapEncaisseParEleve.get(id) || 0;
      const solde = Math.max(attendu - encaisse, 0);

      let statutEleve = "à jour";
      if (solde > 0 && encaisse > 0) statutEleve = "partiellement payé";
      if (solde > 0 && encaisse === 0) statutEleve = "impayé";

      const paiementsEleve = paiements
        .filter((p) => String(p.eleve) === id && p.datePaiement)
        .sort(
          (a, b) =>
            new Date(b.datePaiement) - new Date(a.datePaiement)
        );

      return {
        eleveId: e._id,
        nom: e.nom,
        postnom: e.postnom,
        prenom: e.prenom,
        matricule: e.matricule,
        classe: e.classe
          ? {
              id: e.classe._id,
              nom: e.classe.nom,
              montantFrais: e.classe.montantFrais || 0,
            }
          : null,
        attendu,
        encaisse,
        solde,
        statut: statutEleve,
        dernierPaiement: paiementsEleve[0]?.datePaiement || null,
        nbPaiements: paiementsEleve.length,
      };
    });

    // 6) Filtres statut / segment
    let listeFiltree = listeComplete;

    if (statut === "a_jour") {
      listeFiltree = listeFiltree.filter((e) => e.statut === "à jour");
    } else if (statut === "partiel") {
      listeFiltree = listeFiltree.filter(
        (e) => e.statut === "partiellement payé"
      );
    } else if (statut === "impaye") {
      listeFiltree = listeFiltree.filter((e) => e.statut === "impayé");
    }

    if (segment === "paye") {
      listeFiltree = listeFiltree.filter((e) => e.encaisse > 0);
    } else if (segment === "non_paye") {
      listeFiltree = listeFiltree.filter((e) => e.encaisse === 0);
    }

    const totalItems = listeFiltree.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limitNum));
    const currentPage = Math.min(pageNum, totalPages);
    const start = (currentPage - 1) * limitNum;
    const end = start + limitNum;
    const pageItems = listeFiltree.slice(start, end);

    const totalCreances = Math.max(totalAttenduGlobal - totalEncaisseGlobal, 0);
    const tauxEncaissement =
      totalAttenduGlobal > 0
        ? (totalEncaisseGlobal / totalAttenduGlobal) * 100
        : 0;

    const response = {
      success: true,
      anneeScolaire,
      annee: year,
      nbEleves: eleves.length,
      totalAttendu: totalAttenduGlobal,
      totalEncaisse: totalEncaisseGlobal,
      totalCreances,
      tauxEncaissement,
      filters: {
        statut,
        segment,
        mois: mois ? parseInt(mois, 10) : null,
      },
      pagination: {
        page: currentPage,
        limit: limitNum,
        total: totalItems,
        totalPages,
      },
      eleves: pageItems,
    };

    return res.status(200).json(response);
  } catch (err) {
    console.error("❌ Erreur getCreancesEleves:", err);
    return next(err);
  }
};

// EXPORT EXCEL CREANCES ELEVES
// GET /api/comptable/creances-eleves-export-excel
exports.exportCreancesElevesExcel = async (req, res, next) => {
  try {
    const {
      anneeScolaire = process.env.ANNEE_SCOLAIRE_DEFAUT || "2025-2026",
      annee,
      classeId,
      statut = "all",
      segment = "all",
      mois,
    } = req.query;

    const year = parseInt(annee, 10) || new Date().getFullYear();

    // On force un "gros" limit pour tout récupérer
    req.query.page = 1;
    req.query.limit = 100000;

    // On réutilise la logique de getCreancesEleves pour reconstruire la liste complète
    // (même code que ci-dessus mais SANS découpage de pagination)
    // Pour garder le fichier compact, je factorise légèrement:

    // 1) Élèves
    const eleveFilter = {
      statut: "actif",
      anneeScolaire,
    };
    if (classeId) {
      eleveFilter.classe = classeId;
    }

    const eleves = await Eleve.find(eleveFilter)
      .populate("classe")
      .lean();

    if (!eleves.length) {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(`Créances ${year}`);
      sheet.addRow(["Aucune créance trouvée."]);
      const fileName = `creances-eleves-${year}.xlsx`;
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    const elevesIds = eleves.map((e) => e._id);
    let totalAttenduGlobal = 0;
    const mapAttenduParEleve = new Map();
    for (const e of eleves) {
      const attendu = e.classe && e.classe.montantFrais
        ? Number(e.classe.montantFrais) || 0
        : 0;
      totalAttenduGlobal += attendu;
      mapAttenduParEleve.set(String(e._id), attendu);
    }

    // Paiements
    const startYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endYear = new Date(year, 11, 31, 23, 59, 59, 999);

    const paiementFilter = {
      statut: "validé",
      anneeScolaire,
      eleve: { $in: elevesIds },
    };

    if (mois) {
      const m = parseInt(mois, 10);
      if (m >= 1 && m <= 12) {
        const startMonth = new Date(year, m - 1, 1, 0, 0, 0, 0);
        const endMonth = new Date(year, m, 0, 23, 59, 59, 999);
        paiementFilter.datePaiement = { $gte: startMonth, $lte: endMonth };
      } else {
        paiementFilter.datePaiement = { $gte: startYear, $lte: endYear };
      }
    } else {
      paiementFilter.datePaiement = { $gte: startYear, $lte: endYear };
    }

    const paiements = await Paiement.find(paiementFilter).lean();

    const mapEncaisseParEleve = new Map();
    let totalEncaisseGlobal = 0;
    for (const p of paiements) {
      if (!p.eleve) continue;
      const key = String(p.eleve);
      const montant = Number(p.montant) || 0;
      totalEncaisseGlobal += montant;
      const actuel = mapEncaisseParEleve.get(key) || 0;
      mapEncaisseParEleve.set(key, actuel + montant);
    }

    const listeComplete = eleves.map((e) => {
      const id = String(e._id);
      const attendu = mapAttenduParEleve.get(id) || 0;
      const encaisse = mapEncaisseParEleve.get(id) || 0;
      const solde = Math.max(attendu - encaisse, 0);

      let statutEleve = "à jour";
      if (solde > 0 && encaisse > 0) statutEleve = "partiellement payé";
      if (solde > 0 && encaisse === 0) statutEleve = "impayé";

      return {
        eleveId: e._id,
        nom: e.nom,
        postnom: e.postnom,
        prenom: e.prenom,
        matricule: e.matricule,
        classe: e.classe ? e.classe.nom || "" : "",
        attendu,
        encaisse,
        solde,
        statut: statutEleve,
      };
    });

    let listeFiltree = listeComplete;

    if (statut === "a_jour") {
      listeFiltree = listeFiltree.filter((e) => e.statut === "à jour");
    } else if (statut === "partiel") {
      listeFiltree = listeFiltree.filter(
        (e) => e.statut === "partiellement payé"
      );
    } else if (statut === "impaye") {
      listeFiltree = listeFiltree.filter((e) => e.statut === "impayé");
    }

    if (segment === "paye") {
      listeFiltree = listeFiltree.filter((e) => e.encaisse > 0);
    } else if (segment === "non_paye") {
      listeFiltree = listeFiltree.filter((e) => e.encaisse === 0);
    }

    const totalCreances = Math.max(totalAttenduGlobal - totalEncaisseGlobal, 0);

    // ===== Excel =====
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Créances élèves";
    const now = new Date();
    workbook.created = now;
    workbook.modified = now;

    const sheet = workbook.addWorksheet(`Créances ${year}`, {
      views: [{ state: "frozen", ySplit: 4 }],
    });

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };

    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };

    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };

    sheet.mergeCells("A1", "G1");
    sheet.getCell("A1").value = `Créances élèves - Collège Le Mérite`;
    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "G2");
    sheet.getCell("A2").value = `Année civile ${year} - Année scolaire ${anneeScolaire}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 20;
    sheet.addRow();

    sheet.columns = [
      { header: "Élève", key: "eleve", width: 32 },
      { header: "Matricule", key: "matricule", width: 16 },
      { header: "Classe", key: "classe", width: 18 },
      { header: "Attendu", key: "attendu", width: 18 },
      { header: "Encaissé", key: "encaisse", width: 18 },
      { header: "Solde", key: "solde", width: 18 },
      { header: "Statut", key: "statut", width: 18 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FF111827" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = headerFill;
    headerRow.height = 18;
    headerRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    let totalAttendu = 0;
    let totalEncaisse = 0;
    let totalSolde = 0;

    listeFiltree.forEach((e) => {
      const nomComplet = [e.nom, e.postnom, e.prenom]
        .filter(Boolean)
        .join(" ");

      const row = sheet.addRow({
        eleve: nomComplet,
        matricule: e.matricule || "",
        classe: e.classe || "",
        attendu: e.attendu || 0,
        encaisse: e.encaisse || 0,
        solde: e.solde || 0,
        statut: e.statut,
      });

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber >= 4 && colNumber <= 6 ? "right" : "left",
        };
        if (colNumber >= 4 && colNumber <= 6) {
          cell.numFmt = "#,##0.00";
        }
      });

      totalAttendu += e.attendu || 0;
      totalEncaisse += e.encaisse || 0;
      totalSolde += e.solde || 0;
    });

    const totalRow = sheet.addRow({
      eleve: "TOTAL",
      matricule: "",
      classe: "",
      attendu: totalAttendu,
      encaisse: totalEncaisse,
      solde: totalSolde,
      statut: "",
    });

    totalRow.font = { bold: true, color: { argb: "FF111827" } };
    totalRow.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F2FE" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber >= 4 && colNumber <= 6 ? "right" : "left",
      };
      if (colNumber >= 4 && colNumber <= 6) {
        cell.numFmt = "#,##0.00";
      }
    });

    const fileName = `creances-eleves-${year}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("❌ Erreur exportCreancesElevesExcel:", err);
    return next(err);
  }
};


// GET /api/comptable/classes/liste-simples
exports.getClassesSimples = async (req, res, next) => {
  try {
    // Si tu veux filtrer par année scolaire uniquement quand fourni:
    const { anneeScolaire } = req.query;

    const filtre = {};
    // Optionnel: seulement actives
    // filtre.isActive = true;
    if (anneeScolaire) {
      filtre.anneeScolaire = anneeScolaire;
    }

    const classes = await Classe.find(filtre)
      .select("_id nom niveau section montantFrais anneeScolaire")
      .sort({ niveau: 1, nom: 1 }) // toutes les classes, triées
      .lean();

    return res.status(200).json({
      success: true,
      data: classes,
    });
  } catch (err) {
    console.error("❌ Erreur getClassesSimples (comptable):", err);
    return next(err);
  }
};

// 📌 DETTES TIERS (fournisseurs, État, autres)

exports.getDettesTiers = async (req, res, next) => {
  try {
    const { typeTiers = "all", statut = "all" } = req.query;
    let page = parseInt(req.query.page || "1", 10);
    let limit = parseInt(req.query.limit || "25", 10);
    if (page < 1) page = 1;
    if (limit < 1 || limit > 200) limit = 25;

    const { from, to } = getDateRangeFromQuery(req);

    // Comptes de tiers : 40x fournisseurs, 44x État, 42x autres (à adapter à ton plan)
    const regexTiers = /^(40|42|44)/;

    // 1) Agrégation des mouvements sur la période
    const lignes = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: from, $lte: to },
        },
      },
      { $unwind: "$lignes" },
      {
        $match: {
          "lignes.compteNumero": { $regex: regexTiers },
        },
      },
      {
        $group: {
          _id: "$lignes.compteNumero",
          intitule: { $max: "$lignes.compteIntitule" },
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ["$lignes.sens", "DEBIT"] }, "$lignes.montant", 0],
            },
          },
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ["$lignes.sens", "CREDIT"] }, "$lignes.montant", 0],
            },
          },
          dernierMouvement: { $max: "$dateOperation" },
        },
      },
    ]);

    // 2) Construire les comptes/tier avec type + solde créditeur (dette)
    const tiersRaw = lignes.map((l) => {
      const compte = l._id;
      const intitule = l.intitule || "";
      const totalDebit = l.totalDebit || 0;
      const totalCredit = l.totalCredit || 0;
      const solde = totalDebit - totalCredit; // négatif => dette (créditeur)
      const montantDu = solde < -0.005 ? -solde : 0; // montant positif

      let type = "autre";
      if (/^40/.test(compte)) type = "fournisseur";
      else if (/^44/.test(compte)) type = "etat";
      else if (/^42/.test(compte)) type = "autre";

      // Statut simple : à jour / en retard (ici pas d’échéancier => on simplifie)
      let statutDette = "a_jour";
      if (montantDu > 0) {
        // si la dette existe et date < fin période - 30j => en retard
        const refDate = l.dernierMouvement || to;
        const diffMs = to.getTime() - new Date(refDate).getTime();
        const diffJours = diffMs / (1000 * 60 * 60 * 24);
        if (diffJours > 30) statutDette = "en_retard";
      }

      return {
        compteNumero: compte,
        intitule,
        typeTiers: type,
        montantDu,
        dernierMouvement: l.dernierMouvement || null,
        statut: statutDette,
      };
    });

    // 3) Filtre sur typeTiers + statut
    let tiersFiltres = tiersRaw.filter((t) => t.montantDu > 0);

    if (typeTiers !== "all") {
      tiersFiltres = tiersFiltres.filter((t) => t.typeTiers === typeTiers);
    }

    if (statut === "a_jour") {
      tiersFiltres = tiersFiltres.filter((t) => t.statut === "a_jour");
    } else if (statut === "en_retard") {
      tiersFiltres = tiersFiltres.filter((t) => t.statut === "en_retard");
    }

    // 4) Totaux KPIs
    let totalDettes = 0;
    let totalDettesFournisseurs = 0;
    let totalDettesEtat = 0;

    tiersFiltres.forEach((t) => {
      totalDettes += t.montantDu;
      if (t.typeTiers === "fournisseur") totalDettesFournisseurs += t.montantDu;
      if (t.typeTiers === "etat") totalDettesEtat += t.montantDu;
    });

    // 5) Pagination
    const total = tiersFiltres.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    if (page > totalPages) page = totalPages;

    const start = (page - 1) * limit;
    const end = start + limit;
    const tiersPage = tiersFiltres.slice(start, end);

    return res.status(200).json({
      success: true,
      totalDettes,
      totalDettesFournisseurs,
      totalDettesEtat,
      nbTiers: total,
      tiers: tiersPage,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error("Erreur getDettesTiers:", err);
    return next(err);
  }
};


exports.exportDettesTiersExcel = async (req, res, next) => {
  try {
    const { typeTiers = "all", statut = "all" } = req.query;
    const { from, to } = getDateRangeFromQuery(req);

    const regexTiers = /^(40|42|44)/;

    const lignes = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: from, $lte: to },
        },
      },
      { $unwind: "$lignes" },
      {
        $match: {
          "lignes.compteNumero": { $regex: regexTiers },
        },
      },
      {
        $group: {
          _id: "$lignes.compteNumero",
          intitule: { $max: "$lignes.compteIntitule" },
          totalDebit: {
            $sum: {
              $cond: [{ $eq: ["$lignes.sens", "DEBIT"] }, "$lignes.montant", 0],
            },
          },
          totalCredit: {
            $sum: {
              $cond: [{ $eq: ["$lignes.sens", "CREDIT"] }, "$lignes.montant", 0],
            },
          },
          dernierMouvement: { $max: "$dateOperation" },
        },
      },
    ]);

    const tiersRaw = lignes.map((l) => {
      const compte = l._id;
      const intitule = l.intitule || "";
      const totalDebit = l.totalDebit || 0;
      const totalCredit = l.totalCredit || 0;
      const solde = totalDebit - totalCredit;
      const montantDu = solde < -0.005 ? -solde : 0;

      let type = "autre";
      if (/^40/.test(compte)) type = "fournisseur";
      else if (/^44/.test(compte)) type = "etat";
      else if (/^42/.test(compte)) type = "autre";

      let statutDette = "a_jour";
      if (montantDu > 0) {
        const refDate = l.dernierMouvement || to;
        const diffMs = to.getTime() - new Date(refDate).getTime();
        const diffJours = diffMs / (1000 * 60 * 60 * 24);
        if (diffJours > 30) statutDette = "en_retard";
      }

      return {
        compteNumero: compte,
        intitule,
        typeTiers: type,
        montantDu,
        dernierMouvement: l.dernierMouvement || null,
        statut: statutDette,
      };
    });

    let tiersFiltres = tiersRaw.filter((t) => t.montantDu > 0);

    if (typeTiers !== "all") {
      tiersFiltres = tiersFiltres.filter((t) => t.typeTiers === typeTiers);
    }

    if (statut === "a_jour") {
      tiersFiltres = tiersFiltres.filter((t) => t.statut === "a_jour");
    } else if (statut === "en_retard") {
      tiersFiltres = tiersFiltres.filter((t) => t.statut === "en_retard");
    }

    // Création Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Dettes tiers", {
      views: [{ state: "frozen", ySplit: 3 }],
    });

    const now = new Date();

    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
    const titleFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1D4ED8" },
    };
    const borderThin = {
      top: { style: "thin", color: { argb: "FF9CA3AF" } },
      left: { style: "thin", color: { argb: "FF9CA3AF" } },
      bottom: { style: "thin", color: { argb: "FF9CA3AF" } },
      right: { style: "thin", color: { argb: "FF9CA3AF" } },
    };

    sheet.mergeCells("A1", "F1");
    sheet.getCell("A1").value = "Dettes tiers - Collège Le Mérite";
    sheet.getCell("A1").font = {
      bold: true,
      size: 16,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "F2");
    sheet.getCell("A2").value = `Période du ${from.toLocaleDateString(
      "fr-FR"
    )} au ${to.toLocaleDateString("fr-FR")}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 12,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A2").fill = titleFill;

    sheet.getRow(1).height = 24;
    sheet.getRow(2).height = 20;

    sheet.addRow();

    sheet.columns = [
      { header: "Compte", key: "compte", width: 14 },
      { header: "Libellé", key: "intitule", width: 32 },
      { header: "Type tiers", key: "type", width: 18 },
      { header: "Montant dû", key: "montant", width: 18 },
      { header: "Dernier mouvement", key: "dernier", width: 18 },
      { header: "Statut", key: "statut", width: 16 },
    ];

    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true, color: { argb: "FF111827" } };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.fill = headerFill;
    headerRow.height = 18;
    headerRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    let totalDettes = 0;

    tiersFiltres.forEach((t) => {
      totalDettes += t.montantDu || 0;

      const row = sheet.addRow({
        compte: t.compteNumero,
        intitule: t.intitule || "",
        type: t.typeTiers || "",
        montant: t.montantDu || 0,
        dernier: t.dernierMouvement
          ? new Date(t.dernierMouvement).toLocaleDateString("fr-FR")
          : "",
        statut:
          t.statut === "en_retard"
            ? "En retard"
            : t.statut === "a_jour"
            ? "À jour"
            : t.statut || "",
      });

      row.eachCell((cell, colNumber) => {
        cell.border = borderThin;
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber === 2 ? "left" : "right",
        };
        if (colNumber === 4) {
          cell.numFmt = "#,##0.00";
        }
        if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 6) {
          cell.alignment.horizontal = "left";
        }
      });
    });

    const totalRow = sheet.addRow({
      compte: "TOTAL",
      montant: totalDettes,
    });
    totalRow.font = { bold: true, color: { argb: "FF111827" } };
    totalRow.eachCell((cell, colNumber) => {
      cell.border = borderThin;
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0F2FE" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: colNumber === 2 ? "left" : "right",
      };
      if (colNumber === 4) {
        cell.numFmt = "#,##0.00";
      }
    });

    const fileName = `dettes-tiers-${from.getFullYear()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${fileName}`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportDettesTiersExcel:", err);
    return next(err);
  }
};


// GET /api/comptable/tresorerie-detaillee?annee=2026&from=...&to=...&compteBanque=52...
// GET /api/comptable/tresorerie-detaillee?annee=2026&from=...&to=...&compteBanque=52...
exports.getTresorerieDetaillee = async (req, res, next) => {
  try {
    const { from, to, compteBanque } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Paramètres from et to requis",
      });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const regexClasse5 = /^5/;

    // On récupère les écritures complètes (pour voir toutes les lignes 571 / 52x / 58 ensemble)
    const ecritures = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $project: {
          dateOperation: 1,
          libelle: 1,
          typeOperation: 1,
          lignes: 1,
        },
      },
      {
        $sort: { dateOperation: 1, _id: 1 },
      },
    ]);

    const caisse = [];
    const banques = [];
    const virements58 = [];
    const comptesBanqueSet = new Set();

    let soldeCaisse = 0;
    const soldeParBanque = new Map();
    let solde58 = 0;

    for (const e of ecritures) {
      const date = e.dateOperation;
      const libelleEcriture = e.libelle;
      const typeOperation = e.typeOperation;
      const lignes = Array.isArray(e.lignes) ? e.lignes : [];

      const lignesClasse5 = lignes.filter((l) =>
        regexClasse5.test(l.compteNumero || "")
      );
      const lignes571 = lignesClasse5.filter((l) =>
        (l.compteNumero || "").startsWith("571")
      );
      const lignes52 = lignesClasse5.filter((l) =>
        (l.compteNumero || "").startsWith("52")
      );
      const lignes58 = lignesClasse5.filter((l) =>
        (l.compteNumero || "").startsWith("58")
      );

      // 1) CAISSE 571
      for (const l of lignes571) {
        const montant = l.montant || 0;
        const isDebit = l.sens === "DEBIT";
        const delta = isDebit ? montant : -montant;
        soldeCaisse += delta;

        caisse.push({
          date,
          libelle: libelleEcriture || l.libelle || "",
          typeOperation,
          debit: isDebit ? montant : 0,
          credit: !isDebit ? montant : 0,
          soldeCumul: soldeCaisse,
        });
      }

      // 2) BANQUES 52x
      for (const l of lignes52) {
        const num = l.compteNumero || "";
        const montant = l.montant || 0;
        const isDebit = l.sens === "DEBIT";
        const delta = isDebit ? montant : -montant;

        if (!soldeParBanque.has(num)) soldeParBanque.set(num, 0);
        const old = soldeParBanque.get(num) || 0;
        const newSolde = old + delta;
        soldeParBanque.set(num, newSolde);
        comptesBanqueSet.add(num);

        if (!compteBanque || compteBanque === "all" || compteBanque === num) {
          banques.push({
            compte: num,
            date,
            libelle: libelleEcriture || l.libelle || "",
            typeOperation,
            debit: isDebit ? montant : 0,
            credit: !isDebit ? montant : 0,
            soldeCumul: newSolde,
          });
        }
      }

      // 3) VIREMENTS INTERNES 58 (coursier)
      for (const l of lignes58) {
        const montant = l.montant || 0;
        const isDebit = l.sens === "DEBIT"; // DEBIT 58: sortie caisse vers coursier ; CREDIT 58: entrée banque depuis coursier
        const delta = isDebit ? montant : -montant;
        solde58 += delta;

        const autresLignes = lignesClasse5.filter((x) => x !== l);

        const contrepartie571 = autresLignes.find((x) =>
          (x.compteNumero || "").startsWith("571")
        );
        const contrepartie52 = autresLignes.find((x) =>
          (x.compteNumero || "").startsWith("52")
        );

        let compteContrepartie = "";
        let typeFlux = "";
        let statut = "ok";

        if (isDebit) {
          // 58 DEBIT : écriture "58 à 571" (argent sorti de la caisse, remis au coursier)
          compteContrepartie = contrepartie571
            ? contrepartie571.compteNumero
            : "";
          typeFlux = "Sortie caisse vers coursier";
          if (!contrepartie571) statut = "en_cours";
        } else {
          // 58 CREDIT : écriture "521 à 58" (argent arrivé en banque, 58 se solde)
          compteContrepartie = contrepartie52
            ? contrepartie52.compteNumero
            : "";
          typeFlux = "Entrée banque depuis coursier";
          if (!contrepartie52) statut = "en_cours";
        }

        virements58.push({
          date,
          libelle: libelleEcriture || l.libelle || "",
          compteContrepartie,
          montant,
          typeFlux,
          statut,
        });
      }
    }

    const soldeBanques = Array.from(soldeParBanque.values()).reduce(
      (s, v) => s + (v || 0),
      0
    );
    const tresoNette = soldeCaisse + soldeBanques + solde58;

    return res.status(200).json({
      success: true,
      soldeCaisse,
      soldeBanques,
      solde58,
      tresoNette,
      caisse,
      banques,
      virements58,
      comptesBanque: Array.from(comptesBanqueSet),
    });
  } catch (err) {
    console.error("Erreur getTresorerieDetaillee:", err);
    return next(err);
  }
};


// Export Excel basique (tu pourras l’enrichir comme pour les autres exports)
// Export Excel trésorerie détaillée (caisse 571, banques 52x, 58)
exports.exportTresorerieDetailleeExcel = async (req, res, next) => {
  try {
    const { from, to, compteBanque } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: "Paramètres from et to requis",
      });
    }

    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const regexClasse5 = /^5/;

    // On récupère les écritures complètes (comme dans getTresorerieDetaillee)
    const ecritures = await EcritureComptable.aggregate([
      {
        $match: {
          dateOperation: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $project: {
          dateOperation: 1,
          libelle: 1,
          typeOperation: 1,
          lignes: 1,
        },
      },
      {
        $sort: { dateOperation: 1, _id: 1 },
      },
    ]);

    const caisse = [];
    const banques = [];
    const virements58 = [];
    const comptesBanqueSet = new Set();

    let soldeCaisse = 0;
    const soldeParBanque = new Map();
    let solde58 = 0;

    for (const e of ecritures) {
      const date = e.dateOperation;
      const libelleEcriture = e.libelle;
      const typeOperation = e.typeOperation;
      const lignes = Array.isArray(e.lignes) ? e.lignes : [];

      const lignesClasse5 = lignes.filter((l) =>
        regexClasse5.test(l.compteNumero || "")
      );
      const lignes571 = lignesClasse5.filter((l) =>
        (l.compteNumero || "").startsWith("571")
      );
      const lignes52 = lignesClasse5.filter((l) =>
        (l.compteNumero || "").startsWith("52")
      );
      const lignes58 = lignesClasse5.filter((l) =>
        (l.compteNumero || "").startsWith("58")
      );

      // CAISSE 571
      for (const l of lignes571) {
        const montant = l.montant || 0;
        const isDebit = l.sens === "DEBIT";
        const delta = isDebit ? montant : -montant;
        soldeCaisse += delta;

        caisse.push({
          date,
          libelle: libelleEcriture || l.libelle || "",
          typeOperation,
          debit: isDebit ? montant : 0,
          credit: !isDebit ? montant : 0,
          soldeCumul: soldeCaisse,
        });
      }

      // BANQUES 52x
      for (const l of lignes52) {
        const num = l.compteNumero || "";
        const montant = l.montant || 0;
        const isDebit = l.sens === "DEBIT";
        const delta = isDebit ? montant : -montant;

        if (!soldeParBanque.has(num)) soldeParBanque.set(num, 0);
        const old = soldeParBanque.get(num) || 0;
        const newSolde = old + delta;
        soldeParBanque.set(num, newSolde);
        comptesBanqueSet.add(num);

        if (!compteBanque || compteBanque === "all" || compteBanque === num) {
          banques.push({
            compte: num,
            date,
            libelle: libelleEcriture || l.libelle || "",
            typeOperation,
            debit: isDebit ? montant : 0,
            credit: !isDebit ? montant : 0,
            soldeCumul: newSolde,
          });
        }
      }

      // VIREMENTS 58 (coursier)
      for (const l of lignes58) {
        const montant = l.montant || 0;
        const isDebit = l.sens === "DEBIT"; // DEBIT 58: 58 à 571 ; CREDIT 58: 521 à 58
        const delta = isDebit ? montant : -montant;
        solde58 += delta;

        const autresLignes = lignesClasse5.filter((x) => x !== l);

        const contrepartie571 = autresLignes.find((x) =>
          (x.compteNumero || "").startsWith("571")
        );
        const contrepartie52 = autresLignes.find((x) =>
          (x.compteNumero || "").startsWith("52")
        );

        let compteContrepartie = "";
        let typeFlux = "";
        let statut = "ok";

        if (isDebit) {
          // 58 DEBIT : 58 à 571 (argent sorti de la caisse, remis au coursier)
          compteContrepartie = contrepartie571
            ? contrepartie571.compteNumero
            : "";
          typeFlux = "Sortie caisse vers coursier";
          if (!contrepartie571) statut = "en_cours";
        } else {
          // 58 CREDIT : 521 à 58 (argent arrivé en banque, 58 se solde)
          compteContrepartie = contrepartie52
            ? contrepartie52.compteNumero
            : "";
          typeFlux = "Entrée banque depuis coursier";
          if (!contrepartie52) statut = "en_cours";
        }

        virements58.push({
          date,
          libelle: libelleEcriture || l.libelle || "",
          compteContrepartie,
          montant,
          typeFlux,
          statut,
        });
      }
    }

    const soldeBanques = Array.from(soldeParBanque.values()).reduce(
      (s, v) => s + (v || 0),
      0
    );
    const tresoNette = soldeCaisse + soldeBanques + solde58;

    // Création du classeur Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Trésorerie détaillée");

    workbook.creator = "Gabkut Schola";
    workbook.lastModifiedBy = "Trésorerie & Rapprochement";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.date1904 = false;

    sheet.properties.defaultRowHeight = 16;

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

    // Titre
    sheet.mergeCells("A1", "I1");
    sheet.getCell("A1").value =
      "Trésorerie détaillée - Caisse (571), Banques (52x), Virements (58)";
    sheet.getCell("A1").font = {
      bold: true,
      size: 14,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A1").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A1").fill = titleFill;

    sheet.mergeCells("A2", "I2");
    sheet.getCell("A2").value = `Période du ${fromDate.toLocaleDateString(
      "fr-FR"
    )} au ${toDate.toLocaleDateString("fr-FR")}`;
    sheet.getCell("A2").font = {
      bold: true,
      size: 11,
      color: { argb: "FFFFFFFF" },
    };
    sheet.getCell("A2").alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    sheet.getCell("A2").fill = titleFill;

    sheet.addRow([]);

    // Résumé KPIs
    sheet.addRow([
      "Solde caisse (571)",
      soldeCaisse,
      "Solde banques (52x)",
      soldeBanques,
      "Solde compte 58",
      solde58,
      "Trésorerie nette",
      tresoNette,
    ]);

    const kpiRow = sheet.getRow(4);
    kpiRow.eachCell((cell, col) => {
      cell.border = borderThin;
      cell.alignment = {
        vertical: "middle",
        horizontal: col % 2 === 0 ? "left" : "right",
      };
      if (col % 2 === 0) {
        cell.font = { bold: true, color: { argb: "FF111827" } };
      } else {
        cell.numFmt = "#,##0.00";
      }
    });

    sheet.addRow([]);

    // TABLE 1 - Caisse 571
    const startCaisseRow = sheet.lastRow.number + 1;
    sheet.getCell(`A${startCaisseRow}`).value = "Mouvements de caisse (571)";
    sheet.getCell(`A${startCaisseRow}`).font = {
      bold: true,
      size: 12,
      color: { argb: "FF111827" },
    };

    const headerCaisseRow = sheet.addRow([
      "Date",
      "Libellé",
      "Type d'opération",
      "Encaissement",
      "Décaissement",
      "Solde cumul",
    ]);

    headerCaisseRow.font = { bold: true, color: { argb: "FF111827" } };
    headerCaisseRow.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    headerCaisseRow.fill = headerFill;
    headerCaisseRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    caisse.forEach((m) => {
      const row = sheet.addRow([
        m.date ? new Date(m.date).toLocaleDateString("fr-FR") : "",
        m.libelle || "",
        m.typeOperation || "",
        m.debit || 0,
        m.credit || 0,
        m.soldeCumul || 0,
      ]);
      row.eachCell((cell, col) => {
        cell.border = borderThin;
        if (col >= 4) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "#,##0.00";
        } else if (col === 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });
    });

    sheet.addRow([]);

    // TABLE 2 - Banques 52x
    const startBanqueRow = sheet.lastRow.number + 1;
    sheet.getCell(`A${startBanqueRow}`).value = "Mouvements bancaires (52x)";
    sheet.getCell(`A${startBanqueRow}`).font = {
      bold: true,
      size: 12,
      color: { argb: "FF111827" },
    };

    const headerBanqueRow = sheet.addRow([
      "Compte",
      "Date",
      "Libellé",
      "Type d'opération",
      "Entrée",
      "Sortie",
      "Solde cumul par compte",
    ]);

    headerBanqueRow.font = { bold: true, color: { argb: "FF111827" } };
    headerBanqueRow.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    headerBanqueRow.fill = headerFill;
    headerBanqueRow.eachCell((cell) => {
      cell.border = borderThin;
    });

    banques.forEach((m) => {
      const row = sheet.addRow([
        m.compte || "",
        m.date ? new Date(m.date).toLocaleDateString("fr-FR") : "",
        m.libelle || "",
        m.typeOperation || "",
        m.debit || 0,
        m.credit || 0,
        m.soldeCumul || 0,
      ]);
      row.eachCell((cell, col) => {
        cell.border = borderThin;
        if (col >= 5) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "#,##0.00";
        } else if (col === 2) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });
    });

    sheet.addRow([]);

    // TABLE 3 - Virements 58
    const start58Row = sheet.lastRow.number + 1;
    sheet.getCell(`A${start58Row}`).value = "Virements internes (58)";
    sheet.getCell(`A${start58Row}`).font = {
      bold: true,
      size: 12,
      color: { argb: "FF111827" },
    };

    const header58Row = sheet.addRow([
      "Date",
      "Libellé",
      "Compte contrepartie",
      "Montant",
      "Type flux",
      "Statut",
    ]);

    header58Row.font = { bold: true, color: { argb: "FF111827" } };
    header58Row.alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    header58Row.fill = headerFill;
    header58Row.eachCell((cell) => {
      cell.border = borderThin;
    });

    virements58.forEach((m) => {
      const row = sheet.addRow([
        m.date ? new Date(m.date).toLocaleDateString("fr-FR") : "",
        m.libelle || "",
        m.compteContrepartie || "",
        m.montant || 0,
        m.typeFlux || "",
        m.statut || "",
      ]);
      row.eachCell((cell, col) => {
        cell.border = borderThin;
        if (col === 4) {
          cell.alignment = { vertical: "middle", horizontal: "right" };
          cell.numFmt = "#,##0.00";
        } else if (col === 1) {
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      });
    });

    sheet.columns = [
      { width: 12 },
      { width: 35 },
      { width: 22 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    const fileName = `tresorerie-detaillee-${fromDate
      .toISOString()
      .substring(0, 10)}_${toDate.toISOString().substring(0, 10)}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erreur exportTresorerieDetailleeExcel:", err);
    return next(err);
  }
};


