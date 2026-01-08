// controllers/classDetailExcelExportController.js

const ExcelJS = require('exceljs');
const Classe = require('../models/Classe');
const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');

// ═══════════════════════════════════════════════════════════════
// 🎨 DESIGN SYSTEM - Couleurs Prestige
// ═══════════════════════════════════════════════════════════════

const COLORS = {
  primary: 'FF3B82F6',      // Bleu premium
  primaryDark: 'FF2563EB',
  success: 'FF10B981',      // Vert succès
  warning: 'FFF59E0B',      // Jaune alerte
  danger: 'FFEF4444',       // Rouge critique
  info: 'FF06B6D4',         // Cyan
  gold: 'FFFBBF24',         // Or accent
  darkBg: 'FF1F2937',       // Fond sombre
  lightBg: 'FFF3F4F6',      // Fond clair
  white: 'FFFFFFFF',
  gray: 'FF6B7280',
  grayLight: 'FFF9FAFB'
};

const FONTS = {
  title: { name: 'Calibri', size: 20, bold: true, color: { argb: COLORS.white } },
  heading: { name: 'Calibri', size: 14, bold: true, color: { argb: COLORS.darkBg } },
  subheading: { name: 'Calibri', size: 12, bold: true, color: { argb: COLORS.primary } },
  normal: { name: 'Calibri', size: 11, color: { argb: COLORS.darkBg } },
  small: { name: 'Calibri', size: 10, color: { argb: COLORS.gray } }
};

// ═══════════════════════════════════════════════════════════════
// 🚀 MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════

exports.exportClassDetailExcel = async (req, res) => {
  try {
    const classeId = req.params.id;
    const annee = req.query.anneeScolaire || '2025-2026';
    const percepteur = req.user;

    console.log(`\n📊 EXPORT EXCEL PREMIUM CLASSE: ${classeId} - ${annee}`);

    // ════════════════════════════════════════════════════════════
    // 1️⃣ RÉCUPÉRER DONNÉES
    // ════════════════════════════════════════════════════════════

    const classe = await Classe.findById(classeId).lean();
    if (!classe) {
      return res.status(404).json({
        success: false,
        message: 'Classe introuvable'
      });
    }

    const eleves = await Eleve.find({
      classe: classeId,
      anneeScolaire: annee
    })
      .lean();

    const eleveIds = eleves.map(e => e._id);
    const paiements = await Paiement.find({
      $or: [
        { eleveId: { $in: eleveIds } },
        { eleve: { $in: eleveIds } }
      ],
      anneeScolaire: annee,
      statut: { $in: ['valid', 'validé'] }
    })
      .lean();

    // ════════════════════════════════════════════════════════════
    // 2️⃣ CALCULS STATS
    // ════════════════════════════════════════════════════════════

    const elevesFull = eleves.map(e => {
      const paiementsEleve = paiements.filter(
        p => (p.eleveId?.toString() === e._id.toString()) || 
             (p.eleve?.toString() === e._id.toString())
      );

      const totalPaye = paiementsEleve.reduce(
        (sum, p) => sum + (p.montant || 0),
        0
      );

      const montantDu = e.montantDu || classe.montantFrais || 0;
      const solde = Math.max(0, montantDu - totalPaye);
      const taux = montantDu > 0 ? (totalPaye / montantDu) * 100 : 0;

      return {
        ...e,
        totalPaye,
        montantDu,
        solde,
        taux,
        estAJour: solde <= 0,
        paiements: paiementsEleve
      };
    });

    const stats = {
      effectif: elevesFull.length,
      elevesAjour: elevesFull.filter(e => e.estAJour).length,
      elevesRetard: elevesFull.filter(e => !e.estAJour).length,
      totalDu: elevesFull.reduce((s, e) => s + e.montantDu, 0),
      totalPaye: elevesFull.reduce((s, e) => s + e.totalPaye, 0),
      totalSolde: elevesFull.reduce((s, e) => s + e.solde, 0),
      tauxGlobal: 0
    };

    stats.tauxGlobal = stats.totalDu > 0 ? (stats.totalPaye / stats.totalDu) * 100 : 0;

    // ════════════════════════════════════════════════════════════
    // 3️⃣ CRÉER WORKBOOK
    // ════════════════════════════════════════════════════════════

    const workbook = new ExcelJS.Workbook();

    // Créer tous les onglets
    createOngletAccueil(workbook, classe, stats, annee, percepteur);
    createOngletDashboard(workbook, classe, stats, annee);
    createOngletClasses(workbook, classe);
    createOngletEleves(workbook, elevesFull, classe);
    createOngletAnalyse(workbook, elevesFull, stats, classe);
    createOngletSolde(workbook, elevesFull, classe);
    createOngletPaiementsDetail(workbook, elevesFull);
    createOngletTendances(workbook, elevesFull, annee);
    createOngletMensualites(workbook, elevesFull, classe);

    // ════════════════════════════════════════════════════════════
    // 4️⃣ ENVOYER FICHIER
    // ════════════════════════════════════════════════════════════

    const fileName = `Classe-${classe.nom}-${annee}-${Date.now()}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Excel généré: ${fileName}\n`);
  } catch (err) {
    console.error('❌ Erreur export Excel:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur génération Excel',
      error: err.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// 📄 ONGLET 1: ACCUEIL PRESTIGE
// ═══════════════════════════════════════════════════════════════

function createOngletAccueil(workbook, classe, stats, annee, percepteur) {
  const sheet = workbook.addWorksheet('🏠 ACCUEIL', { pageSetup: { paperSize: 9, orientation: 'portrait' } });

  // ════ EN-TÊTE PRESTIGE ════
  sheet.mergeCells('A1:E3');
  const headerCell = sheet.getCell('A1');
  headerCell.value = '🎓 COLLÈGE LE MÉRITE';
  headerCell.style = {
    font: { ...FONTS.title, size: 24 },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thick', color: { argb: COLORS.gold } },
      bottom: { style: 'thick', color: { argb: COLORS.gold } }
    }
  };
  sheet.getRow(1).height = 50;

  // ════ TITRE RAPPORT ════
  sheet.mergeCells('A5:E5');
  const rapportCell = sheet.getCell('A5');
  rapportCell.value = `📊 RAPPORT DÉTAIL CLASSE - ${classe.nom}`;
  rapportCell.style = {
    font: { ...FONTS.heading, size: 16 },
    alignment: { horizontal: 'center' },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightBg } }
  };

  // ════ INFOS DOCUMENT ════
  let row = 7;
  const infos = [
    ['Classe:', classe.nom, 'Année Scolaire:', annee],
    ['Niveau:', classe.niveau || 'N/A', 'Frais Inscription:', `${stats.totalDu / stats.effectif || 0} USD`],
    ['Effectif Total:', stats.effectif, 'Générée le:', new Date().toLocaleDateString('fr-FR')],
    ['Percepteur:', percepteur.fullName || percepteur.email, 'Période:', '2025-2026']
  ];

  infos.forEach(line => {
    sheet.getCell(`A${row}`).value = line[0];
    sheet.getCell(`B${row}`).value = line[1];
    sheet.getCell(`D${row}`).value = line[2];
    sheet.getCell(`E${row}`).value = line[3];

    for (let col of ['A', 'B', 'D', 'E']) {
      const cell = sheet.getCell(`${col}${row}`);
      cell.style = { font: FONTS.normal };
      if (['A', 'D'].includes(col)) {
        cell.style.font = { ...FONTS.normal, bold: true };
      }
    }
    row++;
  });

  // ════ PRÉFACE ════
  row = 13;
  sheet.mergeCells(`A${row}:E${row}`);
  const preface = sheet.getCell(`A${row}`);
  preface.value = '📋 PRÉFACE';
  preface.style = { font: FONTS.subheading };
  row++;

  sheet.mergeCells(`A${row}:E${row + 3}`);
  const textPreface = sheet.getCell(`A${row}`);
  textPreface.value =
    `Ce rapport présente l'analyse détaillée des paiements pour la classe ${classe.nom} ` +
    `(${classe.niveau}) pour l'année scolaire ${annee}. ` +
    `Il contient des tableaux récapitulatifs, des analyses par élève, des tendances de paiement, ` +
    `et des diagnostics de solvabilité. Tous les chiffres sont calculés en USD.`;
  textPreface.style = {
    font: FONTS.small,
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
  };
  textPreface.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayLight } };
  row += 4;

  // ════ KPI DASHBOARD MINI ════
  row = 19;
  const kpis = [
    { label: 'ÉLÈVES À JOUR ✅', value: stats.elevesAjour, color: COLORS.success },
    { label: 'ÉLÈVES EN RETARD ⚠️', value: stats.elevesRetard, color: COLORS.danger },
    { label: 'TAUX GLOBAL', value: `${stats.tauxGlobal.toFixed(1)}%`, color: COLORS.warning },
    { label: 'TOTAL COLLECTÉ', value: `${stats.totalPaye} USD`, color: COLORS.info }
  ];

  sheet.getCell(`A${row}`).value = 'RÉSUMÉ EXÉCUTIF';
  sheet.getCell(`A${row}`).style = { font: FONTS.subheading };

  row++;
  kpis.forEach((kpi, idx) => {
    const col = String.fromCharCode(65 + idx); // A, B, C, D
    sheet.mergeCells(`${col}${row}:${col}${row + 2}`);
    const cell = sheet.getCell(`${col}${row}`);
    cell.value = `${kpi.label}\n${kpi.value}`;
    cell.style = {
      font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' } }
    };
    sheet.getColumn(col).width = 18;
  });

  // ════ COLONNES ════
  sheet.columns = [
    { width: 20 },
    { width: 18 },
    { width: 20 },
    { width: 18 },
    { width: 18 }
  ];
}

// ═══════════════════════════════════════════════════════════════
// 📊 ONGLET 2: DASHBOARD ANALYTICS
// ═══════════════════════════════════════════════════════════════

function createOngletDashboard(workbook, classe, stats, annee) {
  const sheet = workbook.addWorksheet('📊 DASHBOARD', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:H2');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `📊 TABLEAU DE BORD - ${classe.nom}`;
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryDark } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  sheet.getRow(1).height = 35;

  // ════ KPI CARDS (4 COLONNES) ════
  const kpiRow = 4;
  const kpiData = [
    { label: 'EFFECTIF', value: stats.effectif, col: 'A', color: COLORS.primary },
    { label: 'À JOUR ✅', value: stats.elevesAjour, col: 'C', color: COLORS.success },
    { label: 'EN RETARD ⚠️', value: stats.elevesRetard, col: 'E', color: COLORS.danger },
    { label: 'TAUX GLOBAL', value: `${stats.tauxGlobal.toFixed(1)}%`, col: 'G', color: COLORS.warning }
  ];

  kpiData.forEach(kpi => {
    const labelCell = sheet.getCell(`${kpi.col}${kpiRow}`);
    labelCell.value = kpi.label;
    labelCell.style = {
      font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: kpi.color } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { style: 'thin' }
    };

    const valCell = sheet.getCell(`${kpi.col}${kpiRow + 1}`);
    valCell.value = kpi.value;
    valCell.style = {
      font: { ...FONTS.heading, size: 18 },
      alignment: { horizontal: 'center', vertical: 'center' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayLight } },
      border: { style: 'thin' }
    };
  });

  // ════ MONTANTS PROMINENTS ════
  const montantsRow = 7;
  const montants = [
    { label: 'TOTAL DÛ', value: `${stats.totalDu} USD`, col: 'A' },
    { label: 'TOTAL COLLECTÉ', value: `${stats.totalPaye} USD`, col: 'C' },
    { label: 'SOLDE DÛ', value: `${stats.totalSolde} USD`, col: 'E' },
    { label: 'TAUX MOYEN', value: `${(stats.totalPaye / stats.totalDu * 100).toFixed(1)}%`, col: 'G' }
  ];

  montants.forEach(m => {
    sheet.mergeCells(`${m.col}${montantsRow}:${m.col}${montantsRow + 1}`);
    const cell = sheet.getCell(`${m.col}${montantsRow}`);
    cell.value = `${m.label}\n${m.value}`;
    cell.style = {
      font: { ...FONTS.normal, bold: true },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightBg } },
      border: { style: 'medium', color: { argb: COLORS.primary } }
    };
  });

  // ════ TABLEAU DISTRIBUTION ════
  const tableRow = 10;
  const headers = ['STATUT', 'NOMBRE', 'POURCENTAGE', 'BARRE VISUELLE'];

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(tableRow, idx + 1);
    cell.value = h;
    cell.style = {
      font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center' },
      border: { style: 'thin' }
    };
  });

  const distribution = [
    { status: 'À jour', nb: stats.elevesAjour, pct: stats.effectif > 0 ? (stats.elevesAjour / stats.effectif * 100) : 0, color: COLORS.success },
    { status: 'En retard', nb: stats.elevesRetard, pct: stats.effectif > 0 ? (stats.elevesRetard / stats.effectif * 100) : 0, color: COLORS.danger }
  ];

  distribution.forEach((d, idx) => {
    const r = tableRow + 1 + idx;
    sheet.getCell(r, 1).value = d.status;
    sheet.getCell(r, 2).value = d.nb;
    sheet.getCell(r, 3).value = d.pct.toFixed(1) + '%';

    const barCell = sheet.getCell(r, 4);
    barCell.value = Math.round(d.pct) + '%';
    barCell.style = {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: d.color } },
      font: { color: { argb: COLORS.white }, bold: true },
      alignment: { horizontal: 'center' }
    };
  });

  sheet.columns = [
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];
}

// ═══════════════════════════════════════════════════════════════
// 📚 ONGLET 3: DÉTAIL CLASSE
// ═══════════════════════════════════════════════════════════════

function createOngletClasses(workbook, classe) {
  const sheet = workbook.addWorksheet('📚 CLASSE', { pageSetup: { paperSize: 9, orientation: 'portrait' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `📚 DÉTAIL CLASSE: ${classe.nom}`;
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.accent } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // ════ INFOS CLASSE ════
  const rows = [
    ['Nom Classe:', classe.nom],
    ['Niveau:', classe.niveau || 'N/A'],
    ['Frais Inscription:', `${classe.montantFrais || 0} USD`],
    ['Mensualité:', `${classe.mensualite || 0} USD`],
    ['Année Scolaire:', '2025-2026'],
    ['Date Création:', new Date(classe.createdAt || Date.now()).toLocaleDateString('fr-FR')]
  ];

  rows.forEach((r, idx) => {
    const row = 3 + idx;
    sheet.getCell(`A${row}`).value = r[0];
    sheet.getCell(`A${row}`).style = { font: { ...FONTS.normal, bold: true } };
    sheet.getCell(`B${row}`).value = r[1];
    sheet.getCell(`B${row}`).style = { font: FONTS.normal };

    for (let c of ['A', 'B']) {
      sheet.getCell(`${c}${row}`).border = { bottom: { style: 'thin' } };
      sheet.getCell(`${c}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.white : COLORS.grayLight } };
    }
  });

  sheet.columns = [{ width: 25 }, { width: 25 }, { width: 25 }, { width: 25 }];
}

// ═══════════════════════════════════════════════════════════════
// 👥 ONGLET 4: ÉLÈVES COMPLETS
// ═══════════════════════════════════════════════════════════════

function createOngletEleves(workbook, elevesFull, classe) {
  const sheet = workbook.addWorksheet('👥 ÉLÈVES', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `👥 LISTE COMPLÈTE DES ÉLÈVES - ${classe.nom}`;
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // ════ EN-TÊTES ════
  const headers = ['#', 'NOM COMPLET', 'MATRICULE', 'SEXE', 'MONTANT DÛ', 'PAYÉ', 'SOLDE', 'TAUX %', 'STATUS'];
  const headerRow = 3;

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(headerRow, idx + 1);
    cell.value = h;
    cell.style = {
      font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { style: 'thin' }
    };
  });

  // ════ DONNÉES ÉLÈVES ════
  elevesFull.forEach((e, idx) => {
    const row = 4 + idx;
    const bgColor = idx % 2 === 0 ? COLORS.white : COLORS.grayLight;

    const cells = [
      idx + 1,
      `${e.nom || ''} ${e.postnom || ''} ${e.prenom || ''}`.trim(),
      e.matricule || '—',
      e.sexe || '—',
      e.montantDu,
      e.totalPaye,
      e.solde,
      e.taux.toFixed(1),
      e.estAJour ? '✅ À JOUR' : '❌ RETARD'
    ];

    cells.forEach((val, colIdx) => {
      const cell = sheet.getCell(row, colIdx + 1);
      cell.value = val;
      cell.style = {
        font: FONTS.normal,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
        border: { style: 'thin' },
        alignment: { horizontal: colIdx < 4 ? 'left' : 'center' }
      };

      // Colorer le taux
      if (colIdx === 7) {
        const tauxVal = parseFloat(val);
        cell.style.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: tauxVal >= 80 ? COLORS.success : tauxVal >= 50 ? COLORS.warning : COLORS.danger
          }
        };
        cell.style.font = { ...FONTS.normal, color: { argb: COLORS.white }, bold: true };
      }
    });
  });

  sheet.columns = [
    { width: 5 },
    { width: 25 },
    { width: 15 },
    { width: 10 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 12 },
    { width: 15 }
  ];
}

// ═══════════════════════════════════════════════════════════════
// 🔍 ONGLET 5: ANALYSE DÉTAILLÉE
// ═══════════════════════════════════════════════════════════════

function createOngletAnalyse(workbook, elevesFull, stats, classe) {
  const sheet = workbook.addWorksheet('🔍 ANALYSE', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '🔍 ANALYSE APPROFONDIE & DIAGNOSTIC';
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryDark } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // ════ SECTIONS D'ANALYSE ════
  let row = 3;

  // Section 1: Élèves critiques
  sheet.getCell(`A${row}`).value = '🔴 ÉLÈVES CRITIQUES (< 30% payés)';
  sheet.getCell(`A${row}`).style = { font: FONTS.subheading, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.danger } }, font: { color: { argb: COLORS.white }, bold: true } };
  sheet.mergeCells(`A${row}:H${row}`);
  row++;

  const critiques = elevesFull.filter(e => e.taux < 30).sort((a, b) => a.taux - b.taux);
  if (critiques.length > 0) {
    ['Nom', 'Montant Dû', 'Payé', 'Solde', 'Taux'].forEach((h, idx) => {
      const cell = sheet.getCell(row, idx + 1);
      cell.value = h;
      cell.style = { font: { ...FONTS.normal, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightBg } } };
    });
    row++;

    critiques.forEach(e => {
      const cells = [
        `${e.nom} ${e.prenom}`,
        e.montantDu,
        e.totalPaye,
        e.solde,
        e.taux.toFixed(1) + '%'
      ];
      cells.forEach((val, idx) => {
        const cell = sheet.getCell(row, idx + 1);
        cell.value = val;
        cell.style = { font: FONTS.normal, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayLight } } };
      });
      row++;
    });
  } else {
    sheet.getCell(`A${row}`).value = '✅ Aucun élève critique';
    row++;
  }

  row += 2;

  // Section 2: Élèves en alerte
  sheet.getCell(`A${row}`).value = '🟡 ÉLÈVES EN ALERTE (30% - 70% payés)';
  sheet.getCell(`A${row}`).style = { font: { ...FONTS.subheading, color: { argb: COLORS.white } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warning } } };
  sheet.mergeCells(`A${row}:H${row}`);
  row++;

  const alertes = elevesFull.filter(e => e.taux >= 30 && e.taux < 70).sort((a, b) => a.taux - b.taux);
  if (alertes.length > 0) {
    ['Nom', 'Montant Dû', 'Payé', 'Solde', 'Taux'].forEach((h, idx) => {
      const cell = sheet.getCell(row, idx + 1);
      cell.value = h;
      cell.style = { font: { ...FONTS.normal, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightBg } } };
    });
    row++;

    alertes.forEach(e => {
      const cells = [
        `${e.nom} ${e.prenom}`,
        e.montantDu,
        e.totalPaye,
        e.solde,
        e.taux.toFixed(1) + '%'
      ];
      cells.forEach((val, idx) => {
        const cell = sheet.getCell(row, idx + 1);
        cell.value = val;
        cell.style = { font: FONTS.normal, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayLight } } };
      });
      row++;
    });
  } else {
    sheet.getCell(`A${row}`).value = '✅ Aucun élève en alerte';
    row++;
  }

  row += 2;

  // Section 3: Élèves exemplaires
  sheet.getCell(`A${row}`).value = '✅ ÉLÈVES À JOUR (70%+)';
  sheet.getCell(`A${row}`).style = { font: { ...FONTS.subheading, color: { argb: COLORS.white } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.success } } };
  sheet.mergeCells(`A${row}:H${row}`);
  row++;

  const exemplaires = elevesFull.filter(e => e.taux >= 70).sort((a, b) => b.taux - a.taux);
  if (exemplaires.length > 0) {
    ['Nom', 'Montant Dû', 'Payé', 'Solde', 'Taux'].forEach((h, idx) => {
      const cell = sheet.getCell(row, idx + 1);
      cell.value = h;
      cell.style = { font: { ...FONTS.normal, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightBg } } };
    });
    row++;

    exemplaires.forEach(e => {
      const cells = [
        `${e.nom} ${e.prenom}`,
        e.montantDu,
        e.totalPaye,
        e.solde,
        e.taux.toFixed(1) + '%'
      ];
      cells.forEach((val, idx) => {
        const cell = sheet.getCell(row, idx + 1);
        cell.value = val;
        cell.style = { font: FONTS.normal, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayLight } } };
      });
      row++;
    });
  }

  sheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];
}

// ═══════════════════════════════════════════════════════════════
// 💰 ONGLET 6: SOLDE & CRÉANCES
// ═══════════════════════════════════════════════════════════════

function createOngletSolde(workbook, elevesFull, classe) {
  const sheet = workbook.addWorksheet('💰 SOLDE', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '💰 SOLDES & CRÉANCES DÉTAILLÉS';
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.danger } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // ════ EN-TÊTES ════
  const headers = ['NOM COMPLET', 'MATRICULE', 'CLASSE', 'MONTANT DÛ', 'MONTANT PAYÉ', 'SOLDE DÛ', 'JOURS RETARD', 'STATUT'];
  const headerRow = 3;

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(headerRow, idx + 1);
    cell.value = h;
    cell.style = {
      font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center' },
      border: { style: 'thin' }
    };
  });

  // ════ DONNÉES TRIÉES PAR SOLDE ════
  const avecSolde = elevesFull.filter(e => e.solde > 0).sort((a, b) => b.solde - a.solde);

  avecSolde.forEach((e, idx) => {
    const row = 4 + idx;
    const jours = Math.floor((Date.now() - new Date(e.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));

    const cells = [
      `${e.nom || ''} ${e.prenom || ''}`.trim(),
      e.matricule || '—',
      classe.nom,
      e.montantDu,
      e.totalPaye,
      e.solde,
      jours,
      jours > 90 ? '🔴 URGENT' : jours > 30 ? '🟡 ATTENTION' : '⚠️ SUIVI'
    ];

    cells.forEach((val, colIdx) => {
      const cell = sheet.getCell(row, colIdx + 1);
      cell.value = val;
      cell.style = {
        font: FONTS.normal,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.white : COLORS.grayLight } },
        border: { style: 'thin' },
        alignment: { horizontal: colIdx < 3 ? 'left' : 'center' }
      };

      // Colorer le solde
      if (colIdx === 5) {
        cell.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.danger } };
        cell.style.font = { ...FONTS.normal, color: { argb: COLORS.white }, bold: true };
      }
    });
  });

  if (avecSolde.length === 0) {
    sheet.getCell('A4').value = '✅ AUCUN SOLDE - Tous les élèves sont à jour !';
    sheet.getCell('A4').style = { font: { ...FONTS.normal, color: { argb: COLORS.success }, bold: true } };
  }

  sheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 20 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 },
    { width: 15 }
  ];
}

// ═══════════════════════════════════════════════════════════════
// 📅 ONGLET 7: PAIEMENTS DÉTAIL
// ═══════════════════════════════════════════════════════════════

function createOngletPaiementsDetail(workbook, elevesFull) {
  const sheet = workbook.addWorksheet('📅 PAIEMENTS', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:G1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '📅 HISTORIQUE DÉTAILLÉ DES PAIEMENTS';
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.info } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // ════ EN-TÊTES ════
  const headers = ['NOM ÉLÈVE', 'MATRICULE', 'DATE PAIEMENT', 'MOIS', 'MONTANT', 'CUMUL', 'RÉFÉRENCE'];
  const headerRow = 3;

  headers.forEach((h, idx) => {
    const cell = sheet.getCell(headerRow, idx + 1);
    cell.value = h;
    cell.style = {
      font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center' },
      border: { style: 'thin' }
    };
  });

  // ════ DONNÉES ════
  let row = 4;
  let cumulGlobal = 0;

  elevesFull.forEach(e => {
    if (!e.paiements || e.paiements.length === 0) return;

    let cumulEleve = 0;
    e.paiements.forEach((p, idx) => {
      cumulEleve += p.montant || 0;
      cumulGlobal += p.montant || 0;

      const cells = [
        idx === 0 ? `${e.nom} ${e.prenom}` : '',
        idx === 0 ? e.matricule : '',
        new Date(p.datePaiement || Date.now()).toLocaleDateString('fr-FR'),
        p.mois || '—',
        p.montant || 0,
        cumulEleve,
        p.reference || '—'
      ];

      cells.forEach((val, colIdx) => {
        const cell = sheet.getCell(row, colIdx + 1);
        cell.value = val;
        cell.style = {
          font: FONTS.small,
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.white : COLORS.grayLight } },
          border: { style: 'thin' },
          alignment: { horizontal: colIdx >= 2 ? 'center' : 'left' }
        };

        if (colIdx === 4) { // Montant
          cell.style.font = { ...FONTS.small, bold: true, color: { argb: COLORS.success } };
        }
      });
      row++;
    });
  });

  // ════ TOTAL ════
  sheet.getCell(`A${row}`).value = 'TOTAL GÉNÉRAL PAIEMENTS';
  sheet.getCell(`A${row}`).style = { font: { ...FONTS.normal, bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.success } } };
  sheet.mergeCells(`A${row}:D${row}`);

  sheet.getCell(`E${row}`).value = cumulGlobal;
  sheet.getCell(`E${row}`).style = { font: { ...FONTS.heading, bold: true, color: { argb: COLORS.white } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.success } } };

  sheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 15 }
  ];
}

// ═══════════════════════════════════════════════════════════════
// 📈 ONGLET 8: TENDANCES
// ═══════════════════════════════════════════════════════════════

function createOngletTendances(workbook, elevesFull, annee) {
  const sheet = workbook.addWorksheet('📈 TENDANCES', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:H1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `📈 TENDANCES & PRÉVISIONS - ${annee}`;
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warning } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  // ════ ANALYSE TENDANCES ════
  let row = 3;

  sheet.getCell(`A${row}`).value = 'ANALYSE PRÉDICTIVE';
  sheet.getCell(`A${row}`).style = { font: FONTS.subheading };
  row += 2;

  const headers = ['NOM', 'TAUX ACTUEL', 'TENDANCE', 'PRÉVISION', 'RISQUE', 'RECOMMANDATION'];
  headers.forEach((h, idx) => {
    const cell = sheet.getCell(row, idx + 1);
    cell.value = h;
    cell.style = {
      font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } },
      alignment: { horizontal: 'center' }
    };
  });
  row++;

  elevesFull.forEach(e => {
    const tauxActuel = e.taux;
    let tendance = '→ STABLE';
    let prevision = tauxActuel + 5;
    let risque = 'FAIBLE';
    let recommandation = 'SUIVI';
    let riskColor = COLORS.success;

    if (tauxActuel < 30) {
      tendance = '📉 DÉCLIN';
      prevision = tauxActuel - 10;
      risque = 'CRITIQUE';
      recommandation = '🚨 RELANCE URGENTE';
      riskColor = COLORS.danger;
    } else if (tauxActuel < 50) {
      tendance = '📉 BAISSE';
      prevision = tauxActuel - 5;
      risque = 'ÉLEVÉ';
      recommandation = '⚠️ RELANCE';
      riskColor = COLORS.warning;
    } else if (tauxActuel < 80) {
      tendance = '📊 MOYEN';
      prevision = tauxActuel + 2;
      risque = 'MOYEN';
      recommandation = '👁️ SUIVI';
      riskColor = COLORS.info;
    } else {
      tendance = '📈 HAUSSE';
      prevision = tauxActuel + 10;
      risque = 'FAIBLE';
      recommandation = '✅ BON';
      riskColor = COLORS.success;
    }

    const cells = [
      `${e.nom} ${e.prenom}`,
      tauxActuel.toFixed(1) + '%',
      tendance,
      Math.min(100, prevision).toFixed(1) + '%',
      risque,
      recommandation
    ];

    cells.forEach((val, colIdx) => {
      const cell = sheet.getCell(row, colIdx + 1);
      cell.value = val;
      cell.style = {
        font: colIdx >= 4 ? { ...FONTS.small, bold: true } : FONTS.small,
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colIdx === 4 ? riskColor : (row % 2 === 0 ? COLORS.white : COLORS.grayLight) } },
        alignment: { horizontal: 'center' },
        border: { style: 'thin' }
      };

      if (colIdx === 4) {
        cell.style.font = { ...FONTS.small, bold: true, color: { argb: COLORS.white } };
      }
    });
    row++;
  });

  sheet.columns = [
    { width: 25 },
    { width: 15 },
    { width: 18 },
    { width: 15 },
    { width: 15 },
    { width: 25 },
    { width: 15 },
    { width: 15 }
  ];
}

// ═══════════════════════════════════════════════════════════════
// 🗓️ ONGLET 9: MENSUALITÉS
// ═══════════════════════════════════════════════════════════════

function createOngletMensualites(workbook, elevesFull, classe) {
  const sheet = workbook.addWorksheet('🗓️ MENSUALITÉS', { pageSetup: { paperSize: 9, orientation: 'landscape' } });

  // ════ TITRE ════
  sheet.mergeCells('A1:L1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = `🗓️ SUIVI MENSUALITÉS - ${classe.nom}`;
  titleCell.style = {
    font: FONTS.title,
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryDark } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const MOIS = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin'];

  // ════ EN-TÊTES ════
  let headerRow = 3;
  const cell0 = sheet.getCell(headerRow, 1);
  cell0.value = 'ÉLÈVE';
  cell0.style = { font: { ...FONTS.normal, bold: true, color: { argb: COLORS.white } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.darkBg } } };

  MOIS.forEach((m, idx) => {
    const cell = sheet.getCell(headerRow, idx + 2);
    cell.value = m;
    cell.style = {
      font: { ...FONTS.small, bold: true, color: { argb: COLORS.white } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } },
      alignment: { horizontal: 'center' }
    };
  });

  // ════ DONNÉES ════
  elevesFull.forEach((e, eleveIdx) => {
    const row = 4 + eleveIdx;

    const eleveCell = sheet.getCell(row, 1);
    eleveCell.value = `${e.nom} ${e.prenom}`.substring(0, 20);
    eleveCell.style = { font: FONTS.small, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: eleveIdx % 2 === 0 ? COLORS.white : COLORS.grayLight } } };

    const paiementsMois = {};
    MOIS.forEach(m => { paiementsMois[m] = false; });

    if (e.paiements) {
      e.paiements.forEach(p => {
        const moisFr = ['Septembre', 'Octobre', 'Novembre', 'Decembre', 'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin'];
        const moisAbr = ['Sept', 'Oct', 'Nov', 'Déc', 'Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin'];
        const idx = moisFr.indexOf(p.mois);
        if (idx >= 0) {
          paiementsMois[moisAbr[idx]] = true;
        }
      });
    }

    MOIS.forEach((m, moisIdx) => {
      const cell = sheet.getCell(row, moisIdx + 2);
      cell.value = paiementsMois[m] ? '✅' : '—';
      cell.style = {
        font: { ...FONTS.small, bold: true, color: { argb: paiementsMois[m] ? COLORS.success : COLORS.gray } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: paiementsMois[m] ? 'FF10B98120' : (eleveIdx % 2 === 0 ? COLORS.white : COLORS.grayLight) } },
        alignment: { horizontal: 'center' },
        border: { style: 'thin' }
      };
    });
  });

  sheet.columns = Array(12).fill({ width: 12 });
}

