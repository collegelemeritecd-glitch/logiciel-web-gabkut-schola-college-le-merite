/**
 * 📊 ADMIN CLASSES REPORT CONTROLLER - GABKUT SCHOLA
 * Rapport classes amélioré : Dashboard + Rapport détaillé + Analyse financière
 * Export Excel multi-onglets avec formatage professionnel
 */

const ExcelJS = require('exceljs');
const Classe = require('../../models/Classe');
const Eleve = require('../../models/Eleve');
const Paiement = require('../../models/Paiement');

function buildFilters(query) {
  const { niveau, mois, noStudents, maxStudents } = query;
  return { niveau, mois, noStudents, maxStudents };
}

/**
 * GET /api/admin/classes/report
 * Retourne les données JSON du rapport
 */
exports.getClassesReportJson = async (req, res, next) => {
  try {
    const { niveau, mois, noStudents, maxStudents } = buildFilters(req.query);
    const anneeScolaire =
      req.query.anneeScolaire || process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';

    const classeFilter = {};
    if (niveau) classeFilter.niveau = niveau;

    const classes = await Classe.find(classeFilter)
      .sort({ niveau: 1, nom: 1 })
      .lean();

    // Effectifs par classe
    const elevesAgg = await Eleve.aggregate([
      { $match: { anneeScolaire, statut: 'actif' } },
      {
        $group: {
          _id: '$classe',
          effectif: { $sum: 1 },
        },
      },
    ]);

    const effectifsMap = new Map();
    elevesAgg.forEach((e) => effectifsMap.set(e._id?.toString(), e.effectif));

    // Paiements validés
    const paiementMatch = { anneeScolaire, statut: 'validé' };
    if (mois) {
      paiementMatch.mois = Number(mois);
    }

    const paiementsAgg = await Paiement.aggregate([
      { $match: paiementMatch },
      {
        $group: {
          _id: '$classe',
          totalPayes: { $sum: '$montant' },
          nombrePaiements: { $sum: 1 },
        },
      },
    ]);

    const payesMap = new Map();
    const paiementsCountMap = new Map();
    paiementsAgg.forEach((p) => {
      payesMap.set(p._id?.toString(), p.totalPayes);
      paiementsCountMap.set(p._id?.toString(), p.nombrePaiements);
    });

    // Paiements par mois pour analyse
    const paiementsParMois = await Paiement.aggregate([
      { $match: { anneeScolaire, statut: 'validé' } },
      {
        $group: {
          _id: '$mois',
          montantMois: { $sum: '$montant' },
          nombreTransactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    let result = classes.map((classe) => {
      const id = classe._id.toString();
      const effectif = effectifsMap.get(id) || 0;
      const totalFrais = effectif * (classe.montantFrais || 0);
      const totalPayes = payesMap.get(id) || 0;
      const reste = totalFrais - totalPayes;
      const tauxRecouvrement =
        totalFrais > 0 ? Math.round((totalPayes / totalFrais) * 100) : 0;

      return {
        _id: id,
        nom: classe.nom,
        niveau: classe.niveau,
        montantFrais: classe.montantFrais || 0,
        mensualite: classe.mensualite || 0,
        effectif,
        totalFrais,
        totalPayes,
        reste,
        tauxRecouvrement,
        nombrePaiements: paiementsCountMap.get(id) || 0,
      };
    });

    if (noStudents === 'yes') {
      result = result.filter((c) => c.effectif === 0);
    }

    if (maxStudents !== undefined && maxStudents !== '') {
      const max = Number(maxStudents);
      if (!Number.isNaN(max)) {
        result = result.filter((c) => c.effectif < max);
      }
    }

    const totalFraisGlobal = result.reduce((s, c) => s + (c.totalFrais || 0), 0);
    const totalPayesGlobal = result.reduce((s, c) => s + (c.totalPayes || 0), 0);
    const totalResteGlobal = totalFraisGlobal - totalPayesGlobal;
    const totalEffectifGlobal = result.reduce((s, c) => s + (c.effectif || 0), 0);
    const tauxReccouvrementGlobal =
      totalFraisGlobal > 0
        ? Math.round((totalPayesGlobal / totalFraisGlobal) * 100)
        : 0;

    res.json({
      success: true,
      anneeScolaire,
      dateGeneration: new Date().toISOString(),
      classes: result,
      totals: {
        totalFrais: totalFraisGlobal,
        totalPayes: totalPayesGlobal,
        totalReste: totalResteGlobal,
        totalEffectif: totalEffectifGlobal,
        tauxRecouvrement: tauxReccouvrementGlobal,
        nombreTransactionsTotal: paiementsAgg.reduce(
          (s, p) => s + (p.nombrePaiements || 0),
          0,
        ),
      },
      paiementsParMois: paiementsParMois.map((p) => ({
        mois: p._id,
        montant: p.montantMois,
        transactions: p.nombreTransactions,
      })),
    });
  } catch (err) {
    console.error('❌ getClassesReportJson error:', err);
    next(err);
  }
};

/**
 * GET /api/admin/classes/report/excel
 * Export Excel multi-onglets avec dashboard, rapport détaillé et analyse
 */
exports.exportClassesReportExcel = async (req, res, next) => {
  try {
    const anneeScolaire =
      req.query.anneeScolaire || process.env.ANNEE_SCOLAIRE_DEFAUT || '2025-2026';
    req.query.anneeScolaire = anneeScolaire;

    let jsonPayload = null;
    const fakeRes = {
      json(payload) {
        jsonPayload = payload;
      },
    };

    await exports.getClassesReportJson(req, fakeRes, next);
    const data = jsonPayload;

    if (!data || !data.success) {
      return res.status(500).json({
        success: false,
        message: 'Erreur génération rapport classes.',
      });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Gabkut Schola';
    workbook.created = new Date();

    // ============================================
    // ONGLET 1 : DASHBOARD
    // ============================================
    const wsDashboard = workbook.addWorksheet('📊 Dashboard', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Titre principal
    wsDashboard.mergeCells('A1:H1');
    const titleCell = wsDashboard.getCell('A1');
    titleCell.value = '📊 TABLEAU DE BORD - GABKUT SCHOLA';
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'center' };
    wsDashboard.getRow(1).height = 28;

    // Sous-titre année scolaire
    wsDashboard.mergeCells('A2:H2');
    const subtitleCell = wsDashboard.getCell('A2');
    subtitleCell.value = `Année scolaire: ${anneeScolaire} | Généré le: ${new Date().toLocaleDateString('fr-FR')}`;
    subtitleCell.font = { italic: true, size: 11, color: { argb: 'FF6B7280' } };
    subtitleCell.alignment = { horizontal: 'center' };
    wsDashboard.getRow(2).height = 20;

    wsDashboard.addRow([]); // Espacement

    // KPIs - Ligne 4
    const kpis = [
      {
        label: 'EFFECTIF TOTAL',
        value: data.totals.totalEffectif,
        color: 'FF3B82F6',
      },
      {
        label: 'FRAIS ATTENDUS',
        value: data.totals.totalFrais,
        color: 'FF10B981',
        format: '#,##0.00',
      },
      {
        label: 'MONTANT PAYÉ',
        value: data.totals.totalPayes,
        color: 'FF8B5CF6',
        format: '#,##0.00',
      },
      {
        label: 'RESTE À PAYER',
        value: data.totals.totalReste,
        color: 'FFF59E0B',
        format: '#,##0.00',
      },
      {
        label: 'TAUX RECOUVREMENT',
        value: `${data.totals.tauxRecouvrement}%`,
        color: 'FF06B6D4',
      },
    ];

    kpis.forEach((kpi, idx) => {
      const col = String.fromCharCode(65 + idx * 1.6); // A, C, E, G...
      const startCol = col;
      const endCol = String.fromCharCode(col.charCodeAt(0) + 1);

      // Cellule label
      const labelCell = wsDashboard.getCell(`${startCol}4`);
      labelCell.value = kpi.label;
      labelCell.font = {
        bold: true,
        size: 10,
        color: { argb: 'FFFFFFFF' },
      };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: kpi.color },
      };
      labelCell.alignment = { horizontal: 'center', vertical: 'center' };
      wsDashboard.getColumn(startCol).width = 18;
      wsDashboard.getRow(4).height = 22;

      // Cellule valeur
      const valueCell = wsDashboard.getCell(`${startCol}5`);
      valueCell.value = kpi.value;
      if (kpi.format) valueCell.numFmt = kpi.format;
      valueCell.font = { bold: true, size: 14, color: { argb: kpi.color } };
      valueCell.alignment = { horizontal: 'center', vertical: 'center' };
      wsDashboard.getRow(5).height = 26;
      valueCell.border = {
        top: { style: 'thin', color: { argb: kpi.color } },
        bottom: { style: 'thin', color: { argb: kpi.color } },
        left: { style: 'thin', color: { argb: kpi.color } },
        right: { style: 'thin', color: { argb: kpi.color } },
      };
    });

    wsDashboard.addRow([]); // Espacement

    // Classement par taux de recouvrement
    wsDashboard.mergeCells('A7:H7');
    const classementTitle = wsDashboard.getCell('A7');
    classementTitle.value = '🏆 CLASSEMENT PAR TAUX DE RECOUVREMENT';
    classementTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    classementTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };
    classementTitle.alignment = { horizontal: 'center' };
    wsDashboard.getRow(7).height = 20;

    // En-têtes classement
    const classementHeaders = ['Rang', 'Classe', 'Taux (%)', 'Payé', 'Attendu'];
    const classementRow = wsDashboard.addRow(classementHeaders);
    classementRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    classementRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    classementRow.alignment = { horizontal: 'center' };
    wsDashboard.getRow(8).height = 18;

    // Tri par taux de recouvrement décroissant
    const classementData = [...data.classes]
      .sort((a, b) => b.tauxRecouvrement - a.tauxRecouvrement)
      .slice(0, 10);

    classementData.forEach((classe, idx) => {
      const row = wsDashboard.addRow([
        idx + 1,
        classe.nom,
        classe.tauxRecouvrement,
        classe.totalPayes,
        classe.totalFrais,
      ]);
      row.getCell(3).numFmt = '0';
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '#,##0.00';

      // Couleur du taux
      const tauxCell = row.getCell(3);
      if (classe.tauxRecouvrement >= 90) {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' },
        };
        tauxCell.font = { color: { argb: 'FF006100' } };
      } else if (classe.tauxRecouvrement >= 70) {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEBCC' },
        };
        tauxCell.font = { color: { argb: 'FF9C6500' } };
      } else {
        tauxCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' },
        };
        tauxCell.font = { color: { argb: 'FF9C0006' } };
      }
    });

    // ============================================
    // ONGLET 2 : RAPPORT DÉTAILLÉ
    // ============================================
    const wsRapport = workbook.addWorksheet('📋 Rapport détaillé', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsRapport.mergeCells('A1:I1');
    const rapportTitle = wsRapport.getCell('A1');
    rapportTitle.value = '📋 RAPPORT DÉTAILLÉ DES CLASSES';
    rapportTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    rapportTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    rapportTitle.alignment = { horizontal: 'center' };
    wsRapport.getRow(1).height = 24;

    wsRapport.columns = [
      { header: 'Classe', key: 'nom', width: 24 },
      { header: 'Niveau', key: 'niveau', width: 12 },
      { header: 'Effectif', key: 'effectif', width: 10 },
      { header: 'Frais/Élève', key: 'montantFrais', width: 14 },
      { header: 'Frais Attendus', key: 'totalFrais', width: 16 },
      { header: 'Montant Payé', key: 'totalPayes', width: 16 },
      { header: 'Reste', key: 'reste', width: 14 },
      { header: 'Taux %', key: 'tauxRecouvrement', width: 10 },
      { header: 'Mensualité', key: 'mensualite', width: 12 },
    ];

    const headerRow = wsRapport.getRow(2);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    headerRow.alignment = { horizontal: 'center', vertical: 'center' };
    wsRapport.getRow(2).height = 20;

    // Ajouter les données
    data.classes
      .sort((a, b) => {
        const niveauOrder = { 'Maternelle': 1, 'CP': 2, 'CE': 3, '6ème': 4 };
        return (
          (niveauOrder[a.niveau] || 999) - (niveauOrder[b.niveau] || 999) ||
          a.nom.localeCompare(b.nom)
        );
      })
      .forEach((classe) => {
        const row = wsRapport.addRow(classe);
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '0';
        row.getCell(9).numFmt = '#,##0.00';

        // Colorer le taux de recouvrement
        const tauxCell = row.getCell(8);
        if (classe.tauxRecouvrement >= 90) {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' },
          };
        } else if (classe.tauxRecouvrement >= 70) {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFEBCC' },
          };
        } else {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' },
          };
        }
      });

    // Total row
    const totalRowNum = wsRapport.rowCount + 1;
    const totalRow = wsRapport.addRow({
      nom: 'TOTAL',
      effectif: data.totals.totalEffectif,
      totalFrais: data.totals.totalFrais,
      totalPayes: data.totals.totalPayes,
      reste: data.totals.totalReste,
      tauxRecouvrement: data.totals.tauxRecouvrement,
    });
    totalRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };
    wsRapport.getRow(totalRowNum).height = 22;

    // ============================================
    // ONGLET 3 : ANALYSE FINANCIÈRE
    // ============================================
    const wsAnalyse = workbook.addWorksheet('💰 Analyse financière', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsAnalyse.mergeCells('A1:F1');
    const analyseTitle = wsAnalyse.getCell('A1');
    analyseTitle.value = '💰 ANALYSE FINANCIÈRE';
    analyseTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    analyseTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF7C3AED' },
    };
    analyseTitle.alignment = { horizontal: 'center' };
    wsAnalyse.getRow(1).height = 24;

    wsAnalyse.addRow([]); // Espacement

    // Résumé financier
    wsAnalyse.addRow(['RÉSUMÉ FINANCIER']);
    wsAnalyse.getRow(3).font = { bold: true, size: 12 };

    const financeSummary = [
      [
        'Montant total attendu:',
        data.totals.totalFrais,
        '#,##0.00',
        'FF10B981',
      ],
      ['Montant total payé:', data.totals.totalPayes, '#,##0.00', 'FF8B5CF6'],
      ['Montant en attente:', data.totals.totalReste, '#,##0.00', 'FFF59E0B'],
      [
        'Taux de recouvrement:',
        `${data.totals.tauxRecouvrement}%`,
        '0',
        'FF06B6D4',
      ],
    ];

    financeSummary.forEach((item) => {
      const row = wsAnalyse.addRow([item[0], item[1]]);
      row.font = { bold: true };
      row.getCell(2).numFmt = item[2];
      row.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: item[3] },
      };
      row.getCell(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    wsAnalyse.addRow([]); // Espacement

    // Paiements par mois
    wsAnalyse.addRow(['ÉVOLUTION PAR MOIS']);
    wsAnalyse.getRow(wsAnalyse.rowCount).font = { bold: true, size: 12 };

    const monthHeaders = wsAnalyse.addRow([
      'Mois',
      'Montant',
      'Nombre de transactions',
    ]);
    monthHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    monthHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    const moisNames = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];

    data.paiementsParMois.forEach((paiement) => {
      const row = wsAnalyse.addRow([
        moisNames[paiement.mois - 1] || `Mois ${paiement.mois}`,
        paiement.montant,
        paiement.transactions,
      ]);
      row.getCell(2).numFmt = '#,##0.00';
    });

    wsAnalyse.columns = [
      { width: 20 },
      { width: 16 },
      { width: 18 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    // ============================================
    // ONGLET 4 : SYNTHÈSE PAR NIVEAU
    // ============================================
    const wsSynthese = workbook.addWorksheet('📑 Synthèse par niveau', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsSynthese.mergeCells('A1:G1');
    const syntheseTitle = wsSynthese.getCell('A1');
    syntheseTitle.value = '📑 SYNTHÈSE PAR NIVEAU D\'ÉTUDES';
    syntheseTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    syntheseTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0891B2' },
    };
    syntheseTitle.alignment = { horizontal: 'center' };
    wsSynthese.getRow(1).height = 24;

    // Regrouper par niveau
    const niveaux = {};
    data.classes.forEach((classe) => {
      if (!niveaux[classe.niveau]) {
        niveaux[classe.niveau] = {
          niveau: classe.niveau,
          classes: [],
          effectifTotal: 0,
          fraisTotal: 0,
          payesTotal: 0,
        };
      }
      niveaux[classe.niveau].classes.push(classe);
      niveaux[classe.niveau].effectifTotal += classe.effectif;
      niveaux[classe.niveau].fraisTotal += classe.totalFrais;
      niveaux[classe.niveau].payesTotal += classe.totalPayes;
    });

    wsSynthese.columns = [
      { header: 'Niveau', key: 'niveau', width: 18 },
      { header: 'Nb Classes', key: 'nbClasses', width: 12 },
      { header: 'Effectif', key: 'effectif', width: 12 },
      { header: 'Frais attendus', key: 'frais', width: 16 },
      { header: 'Montant payé', key: 'payes', width: 16 },
      { header: 'Reste', key: 'reste', width: 14 },
      { header: 'Taux %', key: 'taux', width: 10 },
    ];

    const headerSynthese = wsSynthese.getRow(2);
    headerSynthese.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerSynthese.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    wsSynthese.getRow(2).height = 20;

    Object.values(niveaux)
      .sort((a, b) => a.niveau.localeCompare(b.niveau))
      .forEach((niv) => {
        const reste = niv.fraisTotal - niv.payesTotal;
        const taux =
          niv.fraisTotal > 0
            ? Math.round((niv.payesTotal / niv.fraisTotal) * 100)
            : 0;

        const row = wsSynthese.addRow({
          niveau: niv.niveau,
          nbClasses: niv.classes.length,
          effectif: niv.effectifTotal,
          frais: niv.fraisTotal,
          payes: niv.payesTotal,
          reste,
          taux,
        });

        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '0';

        const tauxCell = row.getCell(7);
        if (taux >= 90) {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC6EFCE' },
          };
        } else if (taux >= 70) {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFEBCC' },
          };
        } else {
          tauxCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' },
          };
        }
      });

    // ============================================
    // ONGLET 5 : ANALYSE PAR MOIS & TRIMESTRE
    // ============================================
    const wsMoisTrimestre = workbook.addWorksheet('📈 Mois & Trimestre', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsMoisTrimestre.mergeCells('A1:F1');
    const moisTitle = wsMoisTrimestre.getCell('A1');
    moisTitle.value = '📈 ANALYSE PAR MOIS & TRIMESTRE';
    moisTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    moisTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8B5CF6' },
    };
    moisTitle.alignment = { horizontal: 'center' };
    wsMoisTrimestre.getRow(1).height = 24;

    wsMoisTrimestre.addRow([]);
    wsMoisTrimestre.addRow(['ANALYSE PAR MOIS']);
    wsMoisTrimestre.getRow(3).font = { bold: true, size: 12 };

    const moisHeaders = wsMoisTrimestre.addRow([
      'Mois',
      'Montant',
      'Transactions',
      'Moyenne/Transaction',
      'Taux Recouvrement',
    ]);
    moisHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    moisHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    const moisNamesArray = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];

    data.paiementsParMois.forEach((paiement) => {
      const moisName = moisNamesArray[paiement.mois - 1] || `Mois ${paiement.mois}`;
      const moyenne =
        paiement.transactions > 0
          ? Math.round(paiement.montant / paiement.transactions)
          : 0;
      const tauxMois = Math.round(
        (paiement.montant / data.totals.totalFrais) * 100,
      );

      const row = wsMoisTrimestre.addRow([
        moisName,
        paiement.montant,
        paiement.transactions,
        moyenne,
        tauxMois,
      ]);
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).numFmt = '0';
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '0';
    });

    wsMoisTrimestre.addRow([]);
    wsMoisTrimestre.addRow(['ANALYSE PAR TRIMESTRE']);
    wsMoisTrimestre.getRow(wsMoisTrimestre.rowCount).font = {
      bold: true,
      size: 12,
    };

    const trimestreHeaders = wsMoisTrimestre.addRow([
      'Trimestre',
      'Montant',
      'Transactions',
      'Moyenne/Transaction',
      'Taux Recouvrement',
    ]);
    trimestreHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    trimestreHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    const trimestres = {
      'T1 (Jan-Mar)': [1, 2, 3],
      'T2 (Avr-Jun)': [4, 5, 6],
      'T3 (Jul-Sep)': [7, 8, 9],
      'T4 (Oct-Dec)': [10, 11, 12],
    };

    Object.entries(trimestres).forEach(([trimName, mois]) => {
      let montantTrim = 0;
      let transactionsTrim = 0;

      data.paiementsParMois.forEach((paiement) => {
        if (mois.includes(paiement.mois)) {
          montantTrim += paiement.montant;
          transactionsTrim += paiement.transactions;
        }
      });

      const moyenneTrim =
        transactionsTrim > 0 ? Math.round(montantTrim / transactionsTrim) : 0;
      const tauxTrim = Math.round(
        (montantTrim / data.totals.totalFrais) * 100,
      );

      const row = wsMoisTrimestre.addRow([
        trimName,
        montantTrim,
        transactionsTrim,
        moyenneTrim,
        tauxTrim,
      ]);
      row.getCell(2).numFmt = '#,##0.00';
      row.getCell(3).numFmt = '0';
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '0';
    });

    wsMoisTrimestre.columns = [
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
    ];

    // ============================================
    // ONGLET 6 : ALERTES & CLASSES À RISQUE
    // ============================================
    const wsAlertes = workbook.addWorksheet('⚠️ Alertes & Risques', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsAlertes.mergeCells('A1:G1');
    const alertesTitle = wsAlertes.getCell('A1');
    alertesTitle.value = '⚠️ ALERTES & CLASSES À RISQUE';
    alertesTitle.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    alertesTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF44336' },
    };
    alertesTitle.alignment = { horizontal: 'center' };
    wsAlertes.getRow(1).height = 24;

    wsAlertes.addRow([]);

    // Classes avec taux < 70%
    wsAlertes.addRow(['🔴 CLASSES CRITIQUES (Taux < 70%)']);
    wsAlertes.getRow(3).font = { bold: true, size: 12, color: { argb: 'FFF44336' } };

    const classesArisque = data.classes.filter((c) => c.tauxRecouvrement < 70);
    if (classesArisque.length > 0) {
      const alerteHeaders = wsAlertes.addRow([
        'Classe',
        'Niveau',
        'Effectif',
        'Frais Attendus',
        'Payé',
        'Reste',
        'Taux %',
      ]);
      alerteHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      alerteHeaders.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF44336' },
      };

      classesArisque
        .sort((a, b) => a.tauxRecouvrement - b.tauxRecouvrement)
        .forEach((classe) => {
          const row = wsAlertes.addRow([
            classe.nom,
            classe.niveau,
            classe.effectif,
            classe.totalFrais,
            classe.totalPayes,
            classe.reste,
            classe.tauxRecouvrement,
          ]);
          row.getCell(4).numFmt = '#,##0.00';
          row.getCell(5).numFmt = '#,##0.00';
          row.getCell(6).numFmt = '#,##0.00';
          row.getCell(7).numFmt = '0';
          row.getCell(7).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCCCC' },
          };
        });
    } else {
      wsAlertes.addRow(['✅ Aucune classe critique']);
    }

    wsAlertes.addRow([]);

    // Classes avec peu de paiements
    wsAlertes.addRow(['🟡 CLASSES À RELANCER (< 5 paiements)']);
    wsAlertes.getRow(wsAlertes.rowCount).font = {
      bold: true,
      size: 12,
      color: { argb: 'FFF59E0B' },
    };

    const classesAPrelancer = data.classes.filter((c) => c.nombrePaiements < 5);
    if (classesAPrelancer.length > 0) {
      const relanceHeaders = wsAlertes.addRow([
        'Classe',
        'Effectif',
        'Nb Paiements',
        'Montant Payé',
        'Action',
      ]);
      relanceHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      relanceHeaders.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF59E0B' },
      };

      classesAPrelancer
        .sort((a, b) => a.nombrePaiements - b.nombrePaiements)
        .forEach((classe) => {
          const action =
            classe.nombrePaiements === 0
              ? 'Relance immédiate'
              : 'Relance recommandée';
          const row = wsAlertes.addRow([
            classe.nom,
            classe.effectif,
            classe.nombrePaiements,
            classe.totalPayes,
            action,
          ]);
          row.getCell(4).numFmt = '#,##0.00';
        });
    } else {
      wsAlertes.addRow(['✅ Aucune classe à relancer']);
    }

    wsAlertes.columns = [
      { width: 20 },
      { width: 12 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 14 },
      { width: 10 },
    ];

    // ============================================
    // ONGLET 7 : RÉSUMÉ EXÉCUTIF
    // ============================================
    const wsResume = workbook.addWorksheet('📄 Résumé Exécutif', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    wsResume.mergeCells('A1:H1');
    const resumeTitle = wsResume.getCell('A1');
    resumeTitle.value = '📄 RÉSUMÉ EXÉCUTIF - GABKUT SCHOLA';
    resumeTitle.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    resumeTitle.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF059669' },
    };
    resumeTitle.alignment = { horizontal: 'center' };
    wsResume.getRow(1).height = 28;

    wsResume.mergeCells('A2:H2');
    const resumeSubtitle = wsResume.getCell('A2');
    resumeSubtitle.value = `Année scolaire: ${anneeScolaire} | Date: ${new Date().toLocaleDateString('fr-FR')}`;
    resumeSubtitle.font = { italic: true, size: 11 };
    wsResume.getRow(2).height = 18;

    wsResume.addRow([]);

    // Résumé financier global
    wsResume.addRow(['SITUATION FINANCIÈRE GLOBALE']);
    wsResume.getRow(4).font = { bold: true, size: 12 };

    const summaryData = [
      ['Nombre total de classes', data.classes.length],
      ['Nombre total d\'élèves', data.totals.totalEffectif],
      ['Montant total attendu', data.totals.totalFrais],
      ['Montant total payé', data.totals.totalPayes],
      ['Montant en retard', data.totals.totalReste],
      ['Taux de recouvrement global', `${data.totals.tauxRecouvrement}%`],
    ];

    summaryData.forEach((item) => {
      const row = wsResume.addRow(['', item[0], item[1]]);
      row.font = { bold: true };
      row.getCell(2).font = { bold: true, size: 11 };
      if (
        typeof item[1] === 'number' &&
        item[0].includes('Montant') &&
        !item[0].includes('retard')
      ) {
        row.getCell(3).numFmt = '#,##0.00';
      } else if (item[0].includes('retard')) {
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(3).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFCCCC' },
        };
      } else if (
        typeof item[1] === 'number' &&
        item[0].includes('payé') &&
        !item[0].includes('retard')
      ) {
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(3).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC6EFCE' },
        };
      }
    });

    wsResume.addRow([]);

    // Analyse par niveau
    wsResume.addRow(['ANALYSE PAR NIVEAU']);
    wsResume.getRow(wsResume.rowCount).font = { bold: true, size: 12 };

    const niveauxAnalyse = {};
    data.classes.forEach((classe) => {
      if (!niveauxAnalyse[classe.niveau]) {
        niveauxAnalyse[classe.niveau] = {
          classes: 0,
          effectif: 0,
          frais: 0,
          payes: 0,
        };
      }
      niveauxAnalyse[classe.niveau].classes += 1;
      niveauxAnalyse[classe.niveau].effectif += classe.effectif;
      niveauxAnalyse[classe.niveau].frais += classe.totalFrais;
      niveauxAnalyse[classe.niveau].payes += classe.totalPayes;
    });

    const niveauAnalyseHeaders = wsResume.addRow([
      'Niveau',
      'Classes',
      'Élèves',
      'Frais',
      'Payé',
      'Taux %',
    ]);
    niveauAnalyseHeaders.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    niveauAnalyseHeaders.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };

    Object.entries(niveauxAnalyse).forEach(([niveau, data_niveau]) => {
      const taux =
        data_niveau.frais > 0
          ? Math.round((data_niveau.payes / data_niveau.frais) * 100)
          : 0;
      const row = wsResume.addRow([
        niveau,
        data_niveau.classes,
        data_niveau.effectif,
        data_niveau.frais,
        data_niveau.payes,
        taux,
      ]);
      row.getCell(4).numFmt = '#,##0.00';
      row.getCell(5).numFmt = '#,##0.00';
      row.getCell(6).numFmt = '0';
    });

    wsResume.addRow([]);

    // Recommandations
    wsResume.addRow(['RECOMMANDATIONS']);
    wsResume.getRow(wsResume.rowCount).font = { bold: true, size: 12 };

    const recommandations = [];
    if (data.totals.tauxRecouvrement < 80) {
      recommandations.push(
        'Intensifier les relances de paiement - Taux < 80%',
      );
    }
    if (classesArisque.length > 0) {
      recommandations.push(
        `${classesArisque.length} classe(s) critique(s) à traiter en priorité`,
      );
    }
    if (classesAPrelancer.length > 0) {
      recommandations.push(
        `Relancer ${classesAPrelancer.length} classe(s) avec peu de paiements`,
      );
    }
    if (data.totals.tauxRecouvrement >= 90) {
      recommandations.push('✅ Excellent taux de recouvrement!');
    }

    if (recommandations.length === 0) {
      recommandations.push('✅ Situation financière saine');
    }

    recommandations.forEach((rec) => {
      wsResume.addRow(['', rec]);
    });

    wsResume.columns = [
      { width: 8 },
      { width: 35 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
    ];

    // ============================================
    // Envoi du fichier
    // ============================================
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-classes-gabkut-schola-${new Date()
        .toISOString()
        .split('T')[0]}.xlsx"`,
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('❌ exportClassesReportExcel error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur export Excel classes.',
      error: err.message,
    });
  }
};
